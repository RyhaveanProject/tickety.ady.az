const express = require('express');
const router = express.Router();
const Station = require('../models/Station');
const { News, Destination, Faq } = require('../models/Content');
const Trip = require('../models/Trip');
const { ensureTripsForDate, searchTrips } = require('../services/scheduleService');
const dayjs = require('dayjs');

/** Dil prefiksini təyin edir: /az, /en, /ru */
function pickLocale(req) {
  return req.locale || 'az';
}

/* ==================== Ana səhifə ==================== */
router.get('/', (req, res) => {
  res.redirect(`/${pickLocale(req)}`);
});

router.get(['/:lang(az|en|ru)'], async (req, res, next) => {
  try {
    const loc = req.params.lang;
    const stations = await Station.find({ isActive: true }).sort({ order: 1 }).lean();
    const news = await News.find({ isActive: true }).sort({ publishedAt: -1 }).limit(3).lean();
    const destinations = await Destination.find({ isActive: true }).sort({ order: 1 }).limit(4).lean();
    const faqs = await Faq.find({ isActive: true }).sort({ order: 1 }).limit(8).lean();

    // Abşeron xətti cədvəli (bu gün üçün)
    const today = dayjs().format('YYYY-MM-DD');
    await ensureTripsForDate(today);
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
    await ensureTripsForDate(tomorrow);

    const timetable = await buildTimetableRows(today);

    res.render('pages/home', {
      title: 'ADY | Qatarların hərəkət cədvəli və qrafiki',
      bodyClass: 'page-home',
      stations,
      news,
      destinations,
      faqs,
      timetable,
      serverDate: today,
      serverDateTomorrow: tomorrow
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Hərəkət cədvəli səhifəsi ==================== */
router.get(['/:lang(az|en|ru)/hereket-cedveli', '/:lang(az|en|ru)/timetable'], async (req, res, next) => {
  try {
    const daysType = req.query.days_type || 'work_days';
    const roadType = req.query.road_type || 'bxs';
    const today = req.query.date || dayjs().format('YYYY-MM-DD');
    await ensureTripsForDate(today);
    const timetable = await buildTimetableRows(today, roadType, daysType);

    res.render('pages/timetable', {
      title: 'Qatarların hərəkət cədvəli və qrafiki | ADY',
      bodyClass: 'page-timetable',
      timetable,
      daysType,
      roadType,
      date: today
    });
  } catch (e) {
    next(e);
  }
});

/** Cədvəl sətirlərini hazırlayır (Abşeron xətti və ölkədaxili reyslər) */
async function buildTimetableRows(date, roadType = 'bxs', daysType = 'work_days') {
  const stations = await Station.find({ isActive: true }).lean();
  const stationMap = {};
  stations.forEach((s) => (stationMap[s.code] = s.name));

  const trips = await Trip.find({ date, status: { $ne: 'cancelled' } }).sort({ departureTime: 1 }).lean();
  const dow = dayjs(date).day();

  const matchesDays = (trip) => {
    if (daysType === 'work_days') return dow >= 1 && dow <= 5 ? true : trip.line === 'absheron';
    if (daysType === 'non_work_days') return dow === 0 || dow === 6 ? true : trip.line === 'absheron';
    return true;
  };

  const absheron = trips.filter((t) => t.line === 'absheron' && matchesDays(t));
  const domestic = trips.filter((t) => t.line === 'domestic' && matchesDays(t));

  const toRow = (t) => ({
    number: t.trainNumber,
    title: t.trainTitle,
    stops: t.stops.map((s) => ({
      code: s.stationCode,
      name: stationMap[s.stationCode] || s.stationName,
      arrive: s.arrive,
      depart: s.depart
    }))
  });

  return {
    absheronStations: stations
      .filter((s) => s.line !== undefined && (s.region === 'Absheron' || ['BAK', 'BIL', 'KHI', 'SUM', 'XRD'].includes(s.code)))
      .sort((a, b) => (a.order || 0) - (b.order || 0)),
    absheron: absheron.map(toRow),
    domestic: domestic.map(toRow),
    date
  };
}

/* ==================== Populyar istiqamətlər ==================== */
router.get(['/:lang(az|en|ru)/populyar-istiqametler', '/:lang(az|en|ru)/destinations'], async (req, res, next) => {
  try {
    const items = await Destination.find({ isActive: true }).sort({ order: 1 }).lean();
    res.render('pages/destinations', {
      title: 'Populyar istiqamətlər | ADY',
      bodyClass: 'page-destinations',
      items
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:lang(az|en|ru)/populyar-istiqametler/:slug', async (req, res, next) => {
  try {
    const item = await Destination.findOne({ slug: req.params.slug }).lean();
    if (!item) return next();
    res.render('pages/destination-detail', {
      title: `${item.title} | ADY`,
      bodyClass: 'page-destination-detail',
      item
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Xəbərlər ==================== */
router.get(['/:lang(az|en|ru)/xeberler', '/:lang(az|en|ru)/news'], async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = 9;
    const total = await News.countDocuments({ isActive: true });
    const items = await News.find({ isActive: true })
      .sort({ publishedAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();

    res.render('pages/news', {
      title: 'Xəbərlər | ADY',
      bodyClass: 'page-news',
      items,
      page,
      pages: Math.max(1, Math.ceil(total / perPage)),
      total
    });
  } catch (e) {
    next(e);
  }
});

router.get(['/:lang(az|en|ru)/xeberler/:slug', '/:lang(az|en|ru)/news/:slug'], async (req, res, next) => {
  try {
    const item = await News.findOne({ slug: req.params.slug, isActive: true }).lean();
    if (!item) return next();
    const others = await News.find({ isActive: true, slug: { $ne: item.slug } })
      .sort({ publishedAt: -1 })
      .limit(3)
      .lean();
    res.render('pages/news-detail', {
      title: `${item.title} | ADY`,
      bodyClass: 'page-news-detail',
      item,
      others
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
module.exports.buildTimetableRows = buildTimetableRows;
