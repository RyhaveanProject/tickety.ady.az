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
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : h.todayISO();
    const line = req.query.line || 'all';
    await scheduleService.ensureTripsForDate(date);
    const rows = await scheduleService.buildTimetableRows(date, line);
    const stations = await Station.find({ active: true }).sort({ order: 1 }).lean();

    const trips = await Trip.find({ date }).select('_id trainNumber').lean();
    const tripMap = {};
    trips.forEach((t) => { tripMap[t.trainNumber] = String(t._id); });
    rows.forEach((r) => { r.tripId = tripMap[r.number] || ''; });

    res.render('pages/admin/trips', {
      title: res.locals.t('admin.trips'),
      rows, date, line, stations,
      dateText: h.azDate(date),
      today: h.todayISO(),
      pending: await pendingCount()
    });
  } catch (e) { next(e); }
});

pages.get('/reys/:tripId', requireAdmin, async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId).lean();
    if (!trip) return next();

    const maps = (trip.classes || []).map((c) => scheduleService.buildSeatMap(trip, c.code)).filter(Boolean);
    const blocks = await SeatBlock.find({ trip: trip._id, active: true }).lean();
    const orders = await Order.find({ trip: trip._id, status: 'confirmed' }).lean();

    res.render('pages/admin/trip-detail', {
      title: 'Reys ' + trip.trainNumber,
      trip, maps, blocks, orders,
      dateText: h.azDate(trip.date),
      pending: await pendingCount()
    });
  } catch (e) { next(e); }
});

pages.get('/qatarlar', requireAdmin, async (req, res, next) => {
  try {
    const line = req.query.line || 'all';
    const filter = line === 'all' ? {} : { line };
    const trains = await Train.find(filter).sort({ number: 1 }).limit(300).lean();
    res.render('pages/admin/trains', { 
      title: res.locals.t('admin.trains'), 
      trains, 
      line, 
      total: trains.length, 
      pending: await pendingCount() 
    });
  } catch (e) { next(e); }
});

pages.get('/qatarlar/yeni', requireAdmin, async (req, res, next) => {
  try {
    const stations = await Station.find({ active: true }).sort({ country: 1, order: 1 }).lean();
    res.render('pages/admin/train-form', {
      title: res.locals.t('admin.newTitle'),
      train: null,
      stations,
      pending: await pendingCount()
    });
  } catch (e) { next(e); }
});

pages.get('/qatarlar/:id/redakte', requireAdmin, async (req, res, next) => {
  try {
    const train = await Train.findById(req.params.id).lean();
    if (!train) return next();
    const stations = await Station.find({ active: true }).sort({ country: 1, order: 1 }).lean();
    res.render('pages/admin/train-form', {
      title: 'Reysi redaktə et: ' + train.number,
      train,
      stations,
      pending: await pendingCount()
    });
  } catch (e) { next(e); }
});

pages.get('/istifadeciler', requireAdmin, async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(200).lean();
    res.render('pages/admin/users', { 
      title: res.locals.t('admin.users'), 
      users, 
      pending: await pendingCount() 
    });
  } catch (e) { next(e); }
});

pages.get('/sinxronizasiya', requireAdmin, async (req, res, next) => {
  try {
    const logs = await SyncLog.find().sort({ createdAt: -1 }).limit(30).lean();
    const { Setting } = require('../models/index');
    const noticeRow = await Setting.findOne({ key: 'notice' }).lean();
    const tickerRow = await Setting.findOne({ key: 'notice_ticker' }).lean();
    res.render('pages/admin/sync', {
      title: res.locals.t('admin.sync'),
      logs,
      sourceUrl: config.liveSourceUrl,
      enabled: config.liveSyncEnabled,
      intervalHours: config.liveSyncHours,
      noticeValue: noticeRow ? noticeRow.value : adyContent.NOTICE,
      tickerValue: tickerRow ? tickerRow.value : adyContent.NOTICE_TICKER,
      pending: await pendingCount()
    });
  } catch (e) { next(e); }
});

// ==================== API ROUTES ====================
api.use(requireAdmin);

api.post('/payments/:id/approve-card', async (req, res) => {
  try {
    await paymentService.adminApproveCard(req.params.id, req.currentUser.email);
    return res.json({ ok: true, message: '✅ Təsdiqləndi — istifadəçidə OTP ekranı açıldı.' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

api.post('/payments/:id/open-otp', async (req, res) => {
  try {
    await paymentService.adminOpenOtp(req.params.id, req.currentUser.email);
    return res.json({ ok: true, message: '🔄 Yeni OTP ekranı istifadəçidə açıldı.' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

api.post('/payments/:id/approve-final', async (req, res) => {
  try {
    const result = await paymentService.adminFinalApprove(req.params.id, req.currentUser.email);
    return res.json({
      ok: true,
      message: '✅ Biletlər uğurla verildi.',
      pnr: result.tickets && result.tickets.length ? result.tickets[0].pnr : ''
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

api.post('/payments/:id/reject-otp', async (req, res) => {
  try {
    const result = await paymentService.adminRejectOtp(req.params.id, req.currentUser.email);
    return res.json({
      ok: true,
      message: '❌ Səhv OTP — istifadəçidə 2 dəq geri sayım başladı, sonra yeni OTP ekranı açılacaq.',
      code: result.code || ''
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

api.post('/payments/:id/decline', async (req, res) => {
  try {
    await paymentService.adminDecline(req.params.id, (req.body || {}).reason, req.currentUser.email);
    return res.json({ ok: true, message: 'Ödəniş rədd edildi.' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

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

api.delete('/blocks/:blockId', async (req, res) => {
  try {
    await SeatBlock.findByIdAndDelete(req.params.blockId);
    return res.json({ ok: true, message: 'Bağlantı açıldı' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Açılmadı' });
  }
});

// ==================== EXPORTS ====================
module.exports = { pages, api };
