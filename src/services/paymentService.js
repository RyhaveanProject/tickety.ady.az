const crypto = require('crypto');
const Payment = require('../models/Payment');
const User = require('../models/User');
const config = require('../config');
const { maskCard, detectCardBrand, isValidCardNumber, isValidExpiry } = require('../utils/helpers');

function transactionId() {
  return 'TXN' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
}

/**
 * Kart ödənişini başladır (OTP addımı).
 * Demo rejimində 3D-Secure oxşarı axın simulyasiya olunur.
 */
async function initCardPayment({ order, user, cardNumber, holderName, expiry, cvv, ip }) {
  const digits = String(cardNumber).replace(/\D/g, '');

  if (!isValidCardNumber(digits)) {
    return { ok: false, error: 'invalid_card', message: 'Kart nömrəsi yanlışdır.' };
  }
  if (!isValidExpiry(expiry)) {
    return { ok: false, error: 'invalid_expiry', message: 'Bitmə tarixi yanlışdır.' };
  }
  if (!/^\d{3,4}$/.test(String(cvv || ''))) {
    return { ok: false, error: 'invalid_cvv', message: 'CVV kodu yanlışdır.' };
  }
  if (!holderName || holderName.trim().length < 3) {
    return { ok: false, error: 'invalid_holder', message: 'Kart sahibinin adı düzgün deyil.' };
  }

  const last4 = digits.slice(-4);
  // Demo uğursuzluq ssenarisi: 0000 ilə bitən kartlar rədd olunur
  if (last4 === '0000') {
    return { ok: false, error: 'card_declined', message: 'Kart bank tərəfindən rədd edildi.' };
  }

  const otp = config.paymentMode === 'demo' ? config.demoOtp : String(crypto.randomInt(100000, 999999));

  const payment = await Payment.create({
    transactionId: transactionId(),
    order: order._id,
    user: user._id,
    amount: order.total,
    currency: 'AZN',
    method: 'card',
    cardBrand: detectCardBrand(digits),
    cardMask: maskCard(digits),
    holderName: holderName.trim(),
    status: 'otp_sent',
    otpCode: otp,
    ip: ip || ''
  });

  return { ok: true, payment, otp, maskedCard: maskCard(digits) };
}

/** OTP təsdiqi -> ödəniş uğurlu */
async function confirmPayment({ paymentId, otp, ip }) {
  const payment = await Payment.findById(paymentId);
  if (!payment) return { ok: false, error: 'not_found', message: 'Ödəniş tapılmadı.' };
  if (payment.status === 'success') return { ok: true, payment };
  if (payment.status !== 'otp_sent') return { ok: false, error: 'invalid_state', message: 'Ödəniş vəziyyəti yanlışdır.' };

  payment.otpAttempts += 1;
  if (payment.otpAttempts > 5) {
    payment.status = 'failed';
    payment.errorMessage = 'OTP cəhdləri aşıldı.';
    await payment.save();
    return { ok: false, error: 'too_many_attempts', message: 'Təsdiq kodu cəhdləri aşıldı.' };
  }

  if (String(payment.otpCode) !== String(otp)) {
    await payment.save();
    return { ok: false, error: 'wrong_otp', message: 'Təsdiq kodu yanlışdır.' };
  }

  payment.status = 'success';
  await payment.save();

  return { ok: true, payment };
}

/** Balansdan ödəniş */
async function payWithBalance({ order, user }) {
  const fresh = await User.findById(user._id);
  if (!fresh) return { ok: false, error: 'user_not_found', message: 'İstifadəçi tapılmadı.' };
  if (fresh.balance < order.total) {
    return { ok: false, error: 'insufficient_funds', message: 'Balansda kifayət qədər vəsait yoxdur.' };
  }

  fresh.balance = Number((fresh.balance - order.total).toFixed(2));
  await fresh.save();

  const payment = await Payment.create({
    transactionId: transactionId(),
    order: order._id,
    user: user._id,
    amount: order.total,
    method: 'balance',
    status: 'success'
  });

  return { ok: true, payment, balance: fresh.balance };
}

/** Ödənişi geri qaytarır (refund) */
async function refundPayment(paymentId, amount) {
  const payment = await Payment.findById(paymentId);
  if (!payment) return { ok: false };
  payment.status = 'refunded';
  payment.refundedAt = new Date();
  payment.refundedAmount = (payment.refundedAmount || 0) + amount;
  await payment.save();
  return { ok: true, payment };
}

module.exports = { initCardPayment, confirmPayment, payWithBalance, refundPayment, transactionId };
