const express = require('express');
const { Station, Destination, News, Faq, Page, Trip, Order } = require('../models/index');
const scheduleService = require('../services/scheduleService');
const { ticketQrUrl } = require('../services/ticketPdfService');
const config = require('../config');
const ady = require('../config/adyContent');
const h = require('../utils/helpers');

const router = express.Router();

async function datesRange() {
  const today = h.todayISO();
  return { today, maxDate: await scheduleService.maxSaleDate() };
}

/* ==================== Ana səhifə ==================== */
router.get('/', async (req, res, next) => {
  try {
    const { today, maxDate } = await datesRange();
    const [stations, destinations, news, faqs, timetable] = await Promise.all([
      Station.find({ active: true }).sort({ order: 1 }).lean(),
      Destination.find({ active: true }).sort({ order: 1 }).limit(7).lean(),
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
      homeCards: ady.HOME_CARDS,
      serverDate: today,
      serverDateMax: maxDate
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
      title: res.locals.t('nav.timetable'),
      rows,
      date,
      line,
      stations,
      dateText: h.azDate(date),
      today: h.todayISO(),
      maxDate: await scheduleService.maxSaleDate()
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Populyar istiqamətlər ==================== */
router.get('/populyar-istiqametler', async (req, res, next) => {
  try {
    const destinations = await Destination.find({ active: true }).sort({ order: 1 }).lean();
    res.render('pages/destinations', {
      title: res.locals.t('nav.destinations'),
      subtitle: 'ADY-nin Ən Populyar İstiqamətləri',
      destinations
    });
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

    const { today, maxDate } = await datesRange();
    let departures = [];
    if (station) {
      departures = (await scheduleService.buildTimetableRows(today))
        .filter((r) => r.toCode === station.code || r.fromCode === station.code)
        .slice(0, 8);
    }

    res.render('pages/destination-detail', {
      title: destination.title + ' — qatar bileti',
      destination,
      station,
      departures,
      others: await Destination.find({ active: true, slug: { $ne: destination.slug } }).sort({ order: 1 }).limit(6).lean(),
      today,
      maxDate
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Sualım var ==================== */
router.get('/sualim-var', (req, res) => res.redirect('/' + res.locals.locale + '/sualim-var/suallar'));

router.get('/sualim-var/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const page = await Page.findOne({ slug, group: 'sualim', active: true }).lean();
    if (!page) return next();

    const faqs = await Faq.find({ active: true }).sort({ order: 1 }).lean();
    res.render('pages/ady-section', {
      title: page.title,
      section: ady.SECTIONS.sualim,
      currentSlug: slug,
      page,
      faqs,
      stations: []
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Stansiyalar və dayanacaqlar ==================== */
router.get('/stansiya-ve-vagzallar', (req, res) => res.redirect('/' + res.locals.locale + '/stansiya-ve-vagzallar/stansiya-ve-vagzallar'));

router.get('/stansiya-ve-vagzallar/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const page = await Page.findOne({ slug, group: 'stansiya', active: true }).lean();
    if (!page) return next();

    const stations = await Station.find({ active: true }).sort({ order: 1 }).lean();
    res.render('pages/ady-section', {
      title: page.title,
      section: ady.SECTIONS.stansiya,
      currentSlug: slug,
      page,
      faqs: [],
      stations
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
      title: res.locals.t('nav.news'),
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
  res.render('pages/ticket-verify', { title: res.locals.t('nav.verify') });
});

/* ==================== QR ilə açılan bilet görüntüsü ====================
   Bu URL tam ictimai açıqdır — beləliklə QR kodu skan olunduqda brauzer,
   istifadəçi daxil olmamış, bileti bütün detallarla göstərir (PNR-a görə). */
router.get('/bilet-goruntule/:pnr', async (req, res, next) => {
  try {
    const pnr = String(req.params.pnr || '').trim().toUpperCase();
    if (!pnr) return next();
    const { Ticket } = require('../models/index');
    const ticket = await Ticket.findOne({ pnr }).lean();
    if (!ticket) return next();
    const order = await Order.findById(ticket.order).lean();
    const trip = await Trip.findById(ticket.trip).lean();
    res.render('pages/ticket-view', {
      title: 'Bilet — ' + ticket.pnr,
      ticket,
      order: order || null,
      trip: trip || null,
      qrUrl: ticketQrUrl(ticket, res.locals.locale)
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
