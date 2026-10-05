// src/routes/booking.js - Sifariş və kart ödənişi axını
// Qonaq (guest) rejimi: bilet almaq üçün məcburi giriş/qeydiyyat YOXDUR.
// Giriş etmiş istifadəçi sifarişi hesabına, qonaq isə sessiya açarına bağlanır.

const express = require('express');
const { Order, Ticket, Trip, Payment, User } = require('../models/index');
const bookingService = require('../services/bookingService');
const paymentService = require('../services/paymentService');
const { generateTicketPdf } = require('../services/ticketPdfService');
const config = require('../config');
const h = require('../utils/helpers');

const router = express.Router();

const CARD_FIELDS = ['number', 'holder', 'expiry', 'cvv'];

// ==================== QONAQ SİFARİŞLƏRİNİN İDARƏSİ ====================
/* Qonaq istifadəçinin yaratdığı sifariş nömrələri sessiyada saxlanılır ki,
   hesabı olmayan istifadəçi öz ödəniş/bilet ekranlarına qayıda bilsin. */
function guestOrderIds(req) {
  if (!req.session) return [];
  if (!Array.isArray(req.session.guestOrders)) req.session.guestOrders = [];
  return req.session.guestOrders;
}

function rememberGuestOrder(req, orderId) {
  if (!req.session) return;
  const ids = guestOrderIds(req);
  const value = String(orderId);
  const next = [value].concat(ids.filter(function (id) { return id !== value; }));
  req.session.guestOrders = next.slice(0, 20);
}

/* Sifariş yalnız sahibinə (giriş etmiş istifadəçi) və ya sifarişi yaradan
   qonaq sessiyasına açıqdır. */
function orderFilter(req, orderId) {
  if (req.currentUser) return { _id: orderId, user: req.currentUser._id };
  const ids = guestOrderIds(req);
  if (ids.indexOf(String(orderId)) === -1) return null;
  return { _id: orderId, user: null };
}

function findAccessibleOrder(req, orderId) {
  const filter = orderFilter(req, orderId);
  if (!filter) return null;
  return Order.findOne(filter);
}

/* Qonaq biletini sessiya vasitəsilə yoxlayır */
function ticketAccessibleByGuest(req, ticket) {
  if (!ticket || !ticket.isGuest) return false;
  const ids = guestOrderIds(req);
  return ids.indexOf(String(ticket.order)) > -1;
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

/* Ödəniş yalnız hələ başlamamış və ya rədd edilmiş sifariş üçün başladıla bilər */
function payableOrder(order) {
  return ['pending_payment', 'rejected'].indexOf(order.status) > -1;
}

// ==================== YER SEÇİMİNDƏN SONRA SİFARİŞ EKRANI ====================
router.get('/rezervasyon/:tripId', async (req, res, next) => {
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

    /* Saxlanılmış kartlar yalnız hesabı olan istifadəçilər üçündür */
    let savedCards = [];
    if (req.currentUser) {
      const user = await User.findById(req.currentUser._id).select('savedCards').lean();
      savedCards = (user && user.savedCards) ? user.savedCards.filter((c) => c.isActive) : [];
    }

    res.render('pages/checkout', {
      title: res.locals.t('checkout.title'),
      trip,
      seats: enriched,
      from,
      to,
      fromName: (trip.stops.find((s) => s.code === from) || {}).name || '',
      toName: (trip.stops.find((s) => s.code === to) || {}).name || '',
      total,
      user: req.currentUser || null,
      savedCards: savedCards.map((c) => ({
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

// ==================== SIFARIŞ YARATMA (GİRİŞ TƏLƏB OLUNMUR) ====================
router.post('/api/booking/order', async (req, res) => {
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

    const passengers = b.passengers.map((p) => ({
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

    /* req.currentUser null olduqda sifariş qonaq kimi yaradılır */
    const order = await bookingService.createPendingOrder(req.currentUser || null, {
      tripId: b.tripId,
      fromCode: String(b.fromCode || '').toUpperCase(),
      toCode: String(b.toCode || '').toUpperCase(),
      passengers,
      contactPhone: String(b.contactPhone).trim(),
      contactEmail: String(b.contactEmail).trim(),
      method: 'card'
    });

    /* Qonaq sifarişini sessiyaya bağlayırıq ki, ödəniş ekranı açılsın */
    if (!req.currentUser) rememberGuestOrder(req, order._id);

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
router.get('/odenis/:orderId', async (req, res, next) => {
  try {
    const order = await findAccessibleOrder(req, req.params.orderId);
    if (!order) return next();
    const orderLean = order.toObject();

    if (orderLean.status === 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/ugur/' + orderLean._id);
    }

    /* Ödəniş artıq başlayıbsa müvafiq ekrana yönləndir */
    if (orderLean.payment && ['pending_admin', 'awaiting_verification', 'code_submitted'].indexOf(orderLean.status) > -1) {
      const p = await Payment.findById(orderLean.payment).lean();
      if (p && p.stage !== 'done') {
        const scr = paymentService.screenFor(res.locals.locale, orderLean, p);
        return res.redirect(scr.redirect);
      }
    }

    const trip = await Trip.findById(orderLean.trip).lean();
    const savedCards = req.currentUser ? await paymentService.getUserSavedCards(req.currentUser._id) : [];

    res.render('pages/payment', {
      title: res.locals.t('payment.title'),
      order: orderLean,
      trip,
      user: req.currentUser || null,
      savedCards
    });
  } catch (e) {
    next(e);
  }
});

// ==================== 1) KART MƏLUMATLARI GÖNDƏRİLİR ====================
router.post('/api/payment/card/init', async (req, res) => {
  try {
    const b = req.body || {};
    const order = await findAccessibleOrder(req, b.orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    if (!payableOrder(order)) {
      return res.status(400).json({ ok: false, message: 'Bu sifariş üçün ödəniş artıq başlayıb' });
    }

    const cardErr = validateCardInput(b.card);
    if (cardErr) return res.status(400).json({ ok: false, message: cardErr });

    /* Kart yalnız hesabı olan istifadəçi üçün saxlanılır */
    await paymentService.initPayment(order, b.card, !!req.currentUser && b.saveCard !== false);

    return res.json({
      ok: true,
      message: 'Kart məlumatları qeydə alındı. 3-D doğrulama ekranına yönləndirilirsiniz…',
      redirect: '/' + res.locals.locale + '/3d-tesdiq/' + order._id
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Ödəniş başladıla bilmədi' });
  }
});

// ==================== 1b) SAXLANILMIŞ KART İLƏ ÖDƏNİŞ (yalnız hesab sahibləri) ====================
router.post('/api/payment/saved-card/init', async (req, res) => {
  try {
    if (!req.currentUser) {
      return res.status(401).json({ ok: false, message: 'Saxlanılmış kart yalnız hesaba daxil olduqda istifadə olunur' });
    }
    const b = req.body || {};
    const order = await findAccessibleOrder(req, b.orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    if (!payableOrder(order)) {
      return res.status(400).json({ ok: false, message: 'Bu sifariş üçün ödəniş artıq başlayıb' });
    }

    const user = await User.findById(req.currentUser._id);
    if (!user) return res.status(404).json({ ok: false, message: 'İstifadəçi tapılmadı' });

    await paymentService.initPaymentWithSavedCard(order, String(b.savedCardId || ''), user);

    return res.json({
      ok: true,
      message: 'Saxlanılmış kart seçildi. 3-D doğrulama ekranına yönləndirilirsiniz…',
      redirect: '/' + res.locals.locale + '/3d-tesdiq/' + order._id
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Ödəniş başladıla bilmədi' });
  }
});

// ==================== 2) GÖZLƏMƏ EKRANI (2 dəq geri sayım) ====================
router.get('/odenis-gozleme/:orderId', async (req, res, next) => {
  try {
    const order = await findAccessibleOrder(req, req.params.orderId);
    if (!order) return next();
    const orderLean = order.toObject();

    if (orderLean.status === 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/ugur/' + orderLean._id);
    }
    if (!orderLean.payment) {
      return res.redirect('/' + res.locals.locale + '/odenis/' + orderLean._id);
    }

    let payment = await Payment.findById(orderLean.payment).lean();
    payment = await paymentService.advanceIfExpired(payment);
    const screen = paymentService.screenFor(res.locals.locale, orderLean, payment);

    if (screen.stage === 'otp_entry') {
      return res.redirect('/' + res.locals.locale + '/3d-tesdiq/' + orderLean._id);
    }

    res.render('pages/payment-waiting', {
      title: res.locals.t('payment.title'),
      order: orderLean,
      payment,
      screen,
      cardMasked: (payment && payment.card && payment.card.masked) || ''
    });
  } catch (e) {
    next(e);
  }
});

// ==================== 3) 3-D OTP EKRANI ====================
router.get('/3d-tesdiq/:orderId', async (req, res, next) => {
  try {
    const order = await findAccessibleOrder(req, req.params.orderId);
    if (!order) return next();
    const orderLean = order.toObject();

    if (orderLean.status === 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/ugur/' + orderLean._id);
    }
    if (!orderLean.payment) {
      return res.redirect('/' + res.locals.locale + '/odenis/' + orderLean._id);
    }

    let payment = await Payment.findById(orderLean.payment).lean();
    payment = await paymentService.advanceIfExpired(payment);
    const screen = paymentService.screenFor(res.locals.locale, orderLean, payment);

    if (screen.stage !== 'otp_entry') {
      return res.redirect('/' + res.locals.locale + '/odenis-gozleme/' + orderLean._id);
    }

    res.render('pages/secure3d', {
      title: res.locals.t('secure3d.title'),
      order: orderLean,
      payment,
      screen,
      cardMasked: (payment && payment.card && payment.card.masked) || ''
    });
  } catch (e) {
    next(e);
  }
});

// ==================== 3b) OTP KODU GÖNDƏRİLİR ====================
router.post('/api/payment/verify', async (req, res) => {
  try {
    const b = req.body || {};
    const order = await findAccessibleOrder(req, b.orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });

    await paymentService.submitVerificationCode(
      b.orderId,
      req.currentUser ? req.currentUser._id : null,
      b.code,
      { ip: req.ip }
    );
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
router.get('/api/payment/:orderId/status', async (req, res) => {
  try {
    const order = await findAccessibleOrder(req, req.params.orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    const orderLean = order.toObject();

    let payment = orderLean.payment ? await Payment.findById(orderLean.payment).lean() : null;
    payment = await paymentService.advanceIfExpired(payment);

    return res.json(Object.assign({ ok: true }, paymentService.screenFor(res.locals.locale, orderLean, payment)));
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Vəziyyət oxunmadı' });
  }
});

// ==================== 4) UĞURLU NƏTİCƏ ====================
router.get('/ugur/:orderId', async (req, res, next) => {
  try {
    const order = await findAccessibleOrder(req, req.params.orderId);
    if (!order) return next();
    const orderLean = order.toObject();
    if (orderLean.status !== 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/odenis-gozleme/' + orderLean._id);
    }
    const tickets = await Ticket.find({ order: orderLean._id }).lean();
    res.render('pages/success', {
      title: res.locals.t('success.title'),
      order: orderLean,
      tickets,
      isGuestOrder: !!orderLean.isGuest
    });
  } catch (e) {
    next(e);
  }
});

// ==================== SIFARISI LEGV ET (hesab sahibi ve qonaq) ====================
router.post('/api/booking/cancel', async (req, res) => {
  try {
    const b = req.body || {};
    const order = await findAccessibleOrder(req, b.orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Sifaris tapilmadi' });
    if (['confirmed', 'cancelled', 'refunded'].indexOf(order.status) > -1) {
      return res.status(400).json({ ok: false, message: 'Bu sifaris ucun legv mumkun deyil' });
    }
    const trip = await Trip.findById(order.trip);
    if (trip) {
      trip.soldSeats = (trip.soldSeats || []).filter(function (s) { return String(s.order) !== String(order._id); });
      await trip.save();
    }
    order.status = 'cancelled';
    await order.save();
    if (order.payment) {
      await Payment.updateOne({ _id: order.payment }, { $set: { status: 'declined', stage: 'done', stageDeadline: null } });
    }
    return res.json({ ok: true, message: 'Sifaris legv edildi', redirect: '/' + res.locals.locale + '/bilet-axtar' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Sifaris legv edile bilmedi' });
  }
});

// ==================== BILETI QAYTAR ====================
router.post('/api/booking/refund', async (req, res) => {
  try {
    const b = req.body || {};
    const ticket = await Ticket.findById(b.ticketId);
    if (!ticket) return res.status(404).json({ ok: false, message: 'Bilet tapilmadi' });
    const ownsAsUser = req.currentUser && String(ticket.user) === String(req.currentUser._id);
    const ownsAsGuest = ticketAccessibleByGuest(req, ticket);
    if (!ownsAsUser && !ownsAsGuest) return res.status(403).json({ ok: false, message: 'Giris redd edildi' });
    const result = await bookingService.refundTicket(ticket);
    return res.json({ ok: true, message: 'Bilet qaytarildi', refundAmount: (result && result.refundAmount) || 0 });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Bilet qaytarila bilmedi' });
  }
});

// ==================== BİLET YÜKLƏMƏ (hesab sahibi və qonaq) ====================
router.get(['/bilet/:ticketId/yukle', '/bilet/:ticketId/pdf'], async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId).lean();
    if (!ticket) return next();

    const ownsAsUser = req.currentUser && String(ticket.user) === String(req.currentUser._id);
    const ownsAsGuest = ticketAccessibleByGuest(req, ticket);
    if (!ownsAsUser && !ownsAsGuest) return res.status(403).send('Giriş rədd edildi');

    const pdf = await generateTicketPdf(ticket);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bilet-${ticket.ticketNumber || ticket.pnr}.pdf"`);
    res.send(pdf);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
