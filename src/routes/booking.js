const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const Trip = require('../models/Trip');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const { requireAuth } = require('../middleware/auth');
const { validateSeats, createPendingOrder, confirmOrderPayment, refundTicket } = require('../services/bookingService');
const { initCardPayment, confirmPayment, payWithBalance, refundPayment } = require('../services/paymentService');
const { generateTicketPdf } = require('../services/ticketPdfService');
const { normalizePhone, formatDuration } = require('../utils/helpers');

/* ==================== Sərnişin məlumatları səhifəsi ==================== */
router.get('/:lang(az|en|ru)/rezervasyon/:tripId', async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId).lean();
    if (!trip) return next();

    const { from, to } = req.query;
    const seats = JSON.parse(req.query.seats || '[]');
    if (!Array.isArray(seats) || !seats.length) return res.redirect(`/${req.locale || 'az'}/bilet-axtar`);

    const fromStop = trip.stops.find((s) => s.stationCode === from);
    const toStop = trip.stops.find((s) => s.stationCode === to);
    if (!fromStop || !toStop) return res.redirect(`/${req.locale || 'az'}/bilet-axtar`);

    const departTime = fromStop.depart || fromStop.arrive;
    const arriveTime = toStop.arrive || toStop.depart;
    let duration = require('../utils/helpers').timeToMinutes(arriveTime) - require('../utils/helpers').timeToMinutes(departTime);
    if (duration < 0) duration += 1440;

    const total = seats.reduce((s, x) => s + Number(x.price || 0), 0);

    res.render('pages/checkout', {
      title: 'Sərnişin məlumatları | ADY',
      bodyClass: 'page-checkout',
      trip,
      seats,
      from,
      to,
      fromName: fromStop.stationName,
      toName: toStop.stationName,
      departTime,
      arriveTime,
      durationText: formatDuration(duration, req.locale || 'az'),
      total,
      user: req.user || null,
      query: req.query
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== API: sifariş yarat (pending) ==================== */
router.post('/api/booking/order', async (req, res, next) => {
  try {
    const { tripId, from, to, passengers, contact } = req.body;
    if (!tripId || !from || !to || !Array.isArray(passengers) || !passengers.length) {
      return res.status(400).json({ ok: false, error: 'missing_params', message: 'Məlumatlar natamamdır.' });
    }
    if (passengers.length > 4) {
      return res.status(400).json({ ok: false, error: 'too_many', message: 'Bir sifarişdə maksimum 4 bilet almaq olar.' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ ok: false, error: 'trip_not_found', message: 'Reys tapılmadı.' });

    // Yer tutulması yoxlanışı
    const check = await validateSeats(tripId, passengers);
    if (!check.ok) {
      return res.status(409).json({
        ok: false,
        error: check.error,
        conflicts: check.conflicts || [],
        message: 'Seçilmiş yerlərdən bəziləri artıq tutulub. Zəhmət olmasa yenidən seçin.'
      });
    }

    // Sərnişin validasiyası
    for (const p of passengers) {
      if (!p.firstName || !p.lastName || !p.docNumber) {
        return res.status(400).json({ ok: false, error: 'invalid_passenger', message: 'Sərnişin məlumatları natamamdır.' });
      }
    }

    const contactInfo = {
      phone: normalizePhone(contact && contact.phone ? contact.phone : ''),
      email: (contact && contact.email) || ''
    };

    const user = req.user;
    // Guest sifariş üçün müvəqqəti istifadəçi yaratmaq əvəzinə, giriş tələb edirik
    if (!user) {
      return res.status(401).json({
        ok: false,
        error: 'auth_required',
        message: 'Bilet almaq üçün hesabınıza daxil olun və ya qeydiyyatdan keçin.',
        redirect: `/${req.locale || 'az'}/login`
      });
    }

    const order = await createPendingOrder({
      user,
      trip,
      fromCode: from,
      toCode: to,
      passengers,
      contact: contactInfo,
      locale: req.locale || 'az'
    });

    res.json({
      ok: true,
      orderId: order._id,
      orderNo: order.orderNo,
      total: order.total,
      redirect: `/${req.locale || 'az'}/odenis/${order._id}`
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Ödəniş səhifəsi ==================== */
router.get('/:lang(az|en|ru)/odenis/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id }).lean();
    if (!order) return next();
    if (order.status === 'paid') return res.redirect(`/${req.locale || 'az'}/bilet/${order._id}`);

    res.render('pages/payment', {
      title: 'Ödəniş | ADY',
      bodyClass: 'page-payment',
      order,
      user: req.user,
      balance: req.user.balance || 0
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== API: kart ödənişi (OTP göndər) ==================== */
router.post('/api/payment/card/init', requireAuth, async (req, res, next) => {
  try {
    const { orderId, cardNumber, holderName, expiry, cvv } = req.body;
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) return res.status(404).json({ ok: false, error: 'order_not_found', message: 'Sifariş tapılmadı.' });
    if (order.status === 'paid') return res.status(400).json({ ok: false, error: 'already_paid', message: 'Sifariş artıq ödənilib.' });

    const result = await initCardPayment({
      order,
      user: req.user,
      cardNumber,
      holderName,
      expiry,
      cvv,
      ip: req.ip
    });

    if (!result.ok) return res.status(400).json({ ok: false, error: result.error, message: result.message });

    res.json({
      ok: true,
      paymentId: result.payment._id,
      transactionId: result.payment.transactionId,
      maskedCard: result.maskedCard,
      // Demo rejimində OTP istifadəçiyə göstərilir
      demoOtp: result.otp,
      message: 'Təsdiq kodu SMS ilə göndərildi (demo rejimində koddur: ' + result.otp + ').'
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== API: OTP təsdiqi ==================== */
router.post('/api/payment/card/confirm', requireAuth, async (req, res, next) => {
  try {
    const { paymentId, otp } = req.body;
    const result = await confirmPayment({ paymentId, otp, ip: req.ip });
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error, message: result.message });

    const order = await Order.findById(result.payment.order);
    if (!order) return res.status(404).json({ ok: false, error: 'order_not_found' });

    await confirmOrderPayment(order, result.payment);

    res.json({
      ok: true,
      orderId: order._id,
      orderNo: order.orderNo,
      redirect: `/${req.locale || 'az'}/bilet/${order._id}`,
      message: 'Ödəniş uğurla tamamlandı.'
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== API: balansdan ödəniş ==================== */
router.post('/api/payment/balance', requireAuth, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) return res.status(404).json({ ok: false, error: 'order_not_found' });
    if (order.status === 'paid') return res.status(400).json({ ok: false, error: 'already_paid', message: 'Sifariş artıq ödənilib.' });

    const result = await payWithBalance({ order, user: req.user });
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error, message: result.message });

    await confirmOrderPayment(order, result.payment);

    res.json({
      ok: true,
      orderId: order._id,
      balance: result.balance,
      redirect: `/${req.locale || 'az'}/bilet/${order._id}`,
      message: 'Ödəniş balansdan çıxıldı.'
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Uğurlu ödəniş / bilet səhifəsi ==================== */
router.get(['/:lang(az|en|ru)/bilet/:orderId', '/:lang(az|en|ru)/success/:orderId'], requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id }).lean();
    if (!order) return next();
    const tickets = await Ticket.find({ order: order._id }).lean();

    res.render('pages/success', {
      title: 'Bilet uğurla alındı | ADY',
      bodyClass: 'page-success',
      order,
      tickets
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== PDF yükləmə ==================== */
router.get('/:lang(az|en|ru)/bilet/:orderId/pdf', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id }).lean();
    if (!order) return next();
    const tickets = await Ticket.find({ order: order._id, status: { $ne: 'refunded' } }).lean();
    if (!tickets.length) {
      return res.status(404).render('pages/error', { title: '404', code: 404, message: 'Bilet tapılmadı.' });
    }

    const pdf = await generateTicketPdf(order, tickets);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ady-bilet-${order.orderNo}.pdf"`);
    res.send(pdf);
  } catch (e) {
    next(e);
  }
});

/* ==================== Bilet qaytarılması ==================== */
router.post('/api/booking/refund', requireAuth, async (req, res, next) => {
  try {
    const { ticketId } = req.body;
    const result = await refundTicket(ticketId, req.user._id);
    if (!result.ok) {
      const messages = {
        not_found: 'Bilet tapılmadı.',
        already_refunded: 'Bu bilet artıq qaytarılıb.',
        too_late: 'Yola düşməyə 5 dəqiqədən az qaldığı üçün qaytarmaq mümkün deyil.',
        order_not_found: 'Sifariş tapılmadı.'
      };
      return res.status(400).json({ ok: false, error: result.error, message: messages[result.error] || 'Qaytarma alınmadı.' });
    }
    res.json({
      ok: true,
      refundAmount: result.refundAmount,
      fee: result.fee,
      message: `Bilet qaytarıldı. Tutulan xidmət haqqı: ${result.fee} AZN. Geri qaytarılan məbləğ: ${result.refundAmount} AZN.`
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Sifarişi ləğv et ==================== */
router.post('/api/booking/cancel', requireAuth, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) return res.status(404).json({ ok: false, error: 'not_found', message: 'Sifariş tapılmadı.' });
    if (order.status !== 'pending') {
      return res.status(400).json({ ok: false, error: 'invalid_state', message: 'Yalnız ödənilməmiş sifarişi ləğv etmək olar.' });
    }
    order.status = 'cancelled';
    await order.save();
    res.json({ ok: true, redirect: `/${req.locale || 'az'}/kabinet`, message: 'Sifariş ləğv edildi.' });
  } catch (e) {
    next(e);
  }
});

/* ==================== Bilet yoxlama (PNR ilə) ==================== */
router.get('/:lang(az|en|ru)/bilet-yoxlama', (req, res) => {
  res.render('pages/verify-ticket', {
    title: 'Bilet yoxlanışı | ADY',
    bodyClass: 'page-verify',
    ticket: null,
    error: null
  });
});

router.post('/api/tickets/verify', async (req, res, next) => {
  try {
    const { pnr } = req.body;
    if (!pnr) return res.status(400).json({ ok: false, error: 'missing_pnr', message: 'Bilet kodunu daxil edin.' });
    const ticket = await Ticket.findOne({ pnr: String(pnr).trim().toUpperCase() }).lean();
    if (!ticket) return res.status(404).json({ ok: false, error: 'not_found', message: 'Bu kodla bilet tapılmadı.' });
    res.json({
      ok: true,
      ticket: {
        pnr: ticket.pnr,
        passengerName: ticket.passengerName,
        trainNumber: ticket.trainNumber,
        date: ticket.date,
        fromName: ticket.fromName,
        toName: ticket.toName,
        departTime: ticket.departTime,
        wagon: ticket.wagon,
        seat: ticket.seat,
        className: ticket.className,
        status: ticket.status
      }
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
