const express = require('express');
const { Station, Destination, News, Faq } = require('../models/index');
const scheduleService = require('../services/scheduleService');
const config = require('../config');
const h = require('../utils/helpers');

const router = express.Router();

function datesRange() {
  const today = h.todayISO();
  return { today, maxDate: h.isoAddDays(today, config.rules.salesOpenDaysBefore) };
}

/* ==================== Ana səhifə ==================== */
router.get('/', async (req, res, next) => {
  try {
    const { today } = datesRange();
    const [stations, destinations, news, faqs, timetable] = await Promise.all([
      Station.find({ active: true }).sort({ order: 1 }).lean(),
      Destination.find({ active: true }).sort({ order: 1 }).limit(8).lean(),
      News.find({ active: true }).sort({ publishedAt: -1 }).limit(6).lean(),
      Faq.find({ active: true }).sort({ order: 1 }).limit(6).lean(),
      scheduleService.homeTimetable(today)
    ]);

    res.render('pages/home', {
      title: 'ADY — Azərbaycan Dəmir Yolları | Onlayn bilet',
      stations,
      destinations,
      news,
      faqs,
      timetable,
      serverDate: today,
      serverDateMax: h.isoAddDays(today, config.rules.salesOpenDaysBefore)
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Hərəkət cədvəli ==================== */
router.get('/hereket-cedveli', async (req, res, next) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : h.todayISO();
    const line = req.query.line || 'all';
    const rows = await scheduleService.buildTimetableRows(date, line);
    const stations = await Station.find({ active: true }).sort({ order: 1 }).lean();

    res.render('pages/timetable', {
      title: 'Hərəkət cədvəli',
      rows,
      date,
      line,
      stations,
      dateText: h.azDate(date),
      today: h.todayISO(),
      maxDate: h.isoAddDays(h.todayISO(), config.rules.salesOpenDaysBefore)
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Populyar istiqamətlər ==================== */
router.get('/populyar-istiqametler', async (req, res, next) => {
  try {
    const destinations = await Destination.find({ active: true }).sort({ order: 1 }).lean();
    res.render('pages/destinations', { title: 'Populyar istiqamətlər', destinations });
  } catch (e) {
    next(e);
  }
});

router.get('/populyar-istiqametler/:slug', async (req, res, next) => {
  try {
    const destination = await Destination.findOne({ slug: req.params.slug, active: true }).lean();
    if (!destination) return next();

    const station = destination.stationCode
      ? await Station.findOne({ code: destination.stationCode }).lean()
      : null;

    const { today } = datesRange();
    let departures = [];
    if (station) {
      departures = (await scheduleService.buildTimetableRows(today))
        .filter((r) => r.toCode === station.code || r.fromCode === station.code)
        .slice(0, 8);
    }

    res.render('pages/destination-detail', {
      title: destination.title,
      destination,
      station,
      departures,
      today,
      maxDate: h.isoAddDays(today, config.rules.salesOpenDaysBefore)
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Xəbərlər ==================== */
router.get('/xeberler', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = 9;
    const [items, total] = await Promise.all([
      News.find({ active: true }).sort({ publishedAt: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
      News.countDocuments({ active: true })
    ]);

    res.render('pages/news', {
      title: 'Xəbərlər',
      items,
      page,
      pages: Math.max(1, Math.ceil(total / perPage)),
      total
    });
  } catch (e) {
    next(e);
  }
});

router.get('/xeberler/:slug', async (req, res, next) => {
  try {
    const item = await News.findOne({ slug: req.params.slug, active: true }).lean();
    if (!item) return next();
    const related = await News.find({ active: true, slug: { $ne: item.slug } }).sort({ publishedAt: -1 }).limit(3).lean();
    res.render('pages/news-detail', { title: item.title, item, related });
  } catch (e) {
    next(e);
  }
});

/* ==================== Bilet yoxlama ==================== */
router.get('/bilet-yoxlama', (req, res) => {
  res.render('pages/ticket-verify', { title: 'Bilet yoxlama' });
});

module.exports = router;
