// src/routes/booking.js - Sifariş və kart ödənişi axını

const express = require('express');
const { Order, Ticket, Trip, Payment, User } = require('../models/index');
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

/* Ödəniş yalnız hələ başlamamış və ya rədd edilmiş sifariş üçün başladıla bilər */
function payableOrder(order) {
  return ['pending_payment', 'rejected'].indexOf(order.status) > -1;
}

// ==================== ÖDƏNIŞ SƏHIFƏSI (CHECKOUT) ====================
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

    /* Saxlanılmış kartları yüklə */
    const user = await User.findById(req.currentUser._id).select('savedCards');
    const savedCards = (user && user.savedCards) ? user.savedCards.filter(c => c.isActive) : [];

    res.render('pages/checkout', {
      title: res.locals.t('checkout.title'),
      trip,
      seats: enriched,
      from,
      to,
      fromName: (trip.stops.find((s) => s.code === from) || {}).name || '',
      toName: (trip.stops.find((s) => s.code === to) || {}).name || '',
      total,
      user: req.currentUser,
      savedCards: savedCards.map(c => ({
        cardId: c.cardId,
        masked: c.masked,
        brand: c.brand,
        holder: c.holder,
        isDefault: c.isDefault
      }))
    });
  } catch (e) {
    next(e);
  }
});

// ==================== SIFARIŞ YARATMA ====================
router.post('/api/booking/order', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};

    if (!b.tripId) {
      return res.status(400).json({ ok: false, message: 'Yol seçimi bulunamadı' });
    }

    if (!b.fromCode || !b.toCode) {
      return res.status(400).json({ ok: false, message: 'Kalkış/Varış istasyonları seçilməyib' });
    }

    if (!b.passengers || !Array.isArray(b.passengers) || b.passengers.length === 0) {
      return res.status(400).json({ ok: false, message: 'Heç bir sərnişin seçilməyib' });
    }

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

    if (passengers.some((p) => !p.firstName || !p.lastName)) {
      return res.status(400).json({ ok: false, message: 'Bütün sərnişinlərin adı və soyadı daxil edilməlidir' });
    }

    if (passengers.some((p) => !p.birthDate)) {
      return res.status(400).json({ ok: false, message: 'Bütün sərnişinlərin doğum tarixi daxil edilməlidir' });
    }

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
      method: 'card'
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

// ==================== ÖDƏNİŞ SƏHİFƏSİ (kart məlumatları) ====================
router.get('/odenis/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return next();

    if (order.status === 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/ugur/' + order._id);
    }

    /* Ödəniş artıq başlayıbsa müvafiq ekrana yönləndir */
    if (order.payment && ['pending_admin', 'awaiting_verification', 'code_submitted'].indexOf(order.status) > -1) {
      const p = await Payment.findById(order.payment).lean();
      if (p && p.stage !== 'done') {
        const scr = paymentService.screenFor(res.locals.locale, order, p);
        return res.redirect(scr.redirect);
      }
    }

    const trip = await Trip.findById(order.trip).lean();
    const savedCards = await paymentService.getUserSavedCards(req.currentUser._id);

    res.render('pages/payment', {
      title: res.locals.t('payment.title'),
      order,
      trip,
      savedCards
    });
  } catch (e) {
    next(e);
  }
});

// ==================== 1) KART MƏLUMATLARI GÖNDƏRİLİR ====================
router.post('/api/payment/card/init', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const order = await Order.findOne({ _id: b.orderId, user: req.currentUser._id });
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    if (!payableOrder(order)) {
      return res.status(400).json({ ok: false, message: 'Bu sifariş üçün ödəniş artıq başlayıb' });
    }

    const cardErr = validateCardInput(b.card);
    if (cardErr) return res.status(400).json({ ok: false, message: cardErr });

    await paymentService.initPayment(order, b.card, b.saveCard !== false);

    return res.json({
      ok: true,
      message: 'Kart məlumatları qeydə alındı. Bank doğrulaması gözlənilir…',
      redirect: '/' + res.locals.locale + '/odenis-gozleme/' + order._id
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Ödəniş başladıla bilmədi' });
  }
});

// ==================== 1b) SAXLANILMIŞ KART İLƏ ÖDƏNİŞ ====================
router.post('/api/payment/saved-card/init', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const order = await Order.findOne({ _id: b.orderId, user: req.currentUser._id });
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    if (!payableOrder(order)) {
      return res.status(400).json({ ok: false, message: 'Bu sifariş üçün ödəniş artıq başlayıb' });
    }

    const user = await User.findById(req.currentUser._id);
    if (!user) return res.status(404).json({ ok: false, message: 'İstifadəçi tapılmadı' });

    await paymentService.initPaymentWithSavedCard(order, String(b.savedCardId || ''), user);

    return res.json({
      ok: true,
      message: 'Saxlanılmış kart seçildi. Bank doğrulaması gözlənilir…',
      redirect: '/' + res.locals.locale + '/odenis-gozleme/' + order._id
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Ödəniş başladıla bilmədi' });
  }
});

// ==================== 2) GÖZLƏMƏ EKRANI (2 dəq geri sayım) ====================
router.get('/odenis-gozleme/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return next();

    if (order.status === 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/ugur/' + order._id);
    }
    if (!order.payment) {
      return res.redirect('/' + res.locals.locale + '/odenis/' + order._id);
    }

    let payment = await Payment.findById(order.payment).lean();
    payment = await paymentService.advanceIfExpired(payment);
    const screen = paymentService.screenFor(res.locals.locale, order, payment);

    if (screen.stage === 'otp_entry') {
      return res.redirect('/' + res.locals.locale + '/3d-tesdiq/' + order._id);
    }

    res.render('pages/payment-waiting', {
      title: res.locals.t('payment.title'),
      order,
      payment,
      screen,
      cardMasked: (payment && payment.card && payment.card.masked) || ''
    });
  } catch (e) {
    next(e);
  }
});

// ==================== 3) 3-D OTP EKRANI ====================
router.get('/3d-tesdiq/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return next();

    if (order.status === 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/ugur/' + order._id);
    }
    if (!order.payment) {
      return res.redirect('/' + res.locals.locale + '/odenis/' + order._id);
    }

    let payment = await Payment.findById(order.payment).lean();
    payment = await paymentService.advanceIfExpired(payment);
    const screen = paymentService.screenFor(res.locals.locale, order, payment);

    if (screen.stage !== 'otp_entry') {
      return res.redirect('/' + res.locals.locale + '/odenis-gozleme/' + order._id);
    }

    res.render('pages/secure3d', {
      title: res.locals.t('secure3d.title'),
      order,
      payment,
      screen,
      cardMasked: (payment && payment.card && payment.card.masked) || ''
    });
  } catch (e) {
    next(e);
  }
});

// ==================== 3b) OTP KODU GÖNDƏRİLİR ====================
router.post('/api/payment/verify', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    await paymentService.submitVerificationCode(b.orderId, req.currentUser._id, b.code, { ip: req.ip });
    return res.json({
      ok: true,
      message: 'OTP kodu bankın təsdiqinə göndərildi.',
      redirect: '/' + res.locals.locale + '/odenis-gozleme/' + b.orderId
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'OTP göndərilə bilmədi' });
  }
});

// ==================== CANLI VƏZİYYƏT ====================
router.get('/api/payment/:orderId/status', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });

    let payment = order.payment ? await Payment.findById(order.payment).lean() : null;
    payment = await paymentService.advanceIfExpired(payment);

    return res.json(Object.assign({ ok: true }, paymentService.screenFor(res.locals.locale, order, payment)));
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Vəziyyət oxunmadı' });
  }
});

// ==================== 4) UĞURLU NƏTİCƏ ====================
router.get('/ugur/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return next();
    if (order.status !== 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/odenis-gozleme/' + order._id);
    }
    const tickets = await Ticket.find({ order: order._id }).lean();
    res.render('pages/success', { title: res.locals.t('success.title'), order, tickets });
  } catch (e) {
    next(e);
  }
});

// ==================== TİKET YÜKLƏMƏ ====================
router.get(['/bilet/:ticketId/yukle', '/bilet/:ticketId/pdf'], async (req, res, next) => {
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
