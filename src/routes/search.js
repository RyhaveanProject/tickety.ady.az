const express = require('express');
const { Station, Trip } = require('../models/index');
const scheduleService = require('../services/scheduleService');
const config = require('../config');
const h = require('../utils/helpers');

const router = express.Router();

/* ==================== Səhifələr ==================== */

router.get('/bilet-axtar', async (req, res, next) => {
  try {
    const stations = await Station.find({ active: true }).sort({ order: 1 }).lean();
    res.render('pages/ticket-search', {
      title: 'Bilet axtarışı',
      stations,
      today: h.todayISO(),
      maxDate: await scheduleService.maxSaleDate(),
      prefill: {
        from: req.query.from || '',
        to: req.query.to || '',
        passengers: parseInt(req.query.passengers, 10) || 1
      }
    });
  } catch (e) {
    next(e);
  }
});

router.get('/reysler', async (req, res, next) => {
  try {
    const from = String(req.query.from || '').toUpperCase();
    const to = String(req.query.to || '').toUpperCase();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : h.todayISO();
    const passengers = Math.min(config.rules.maxTicketsPerOrder, Math.max(1, parseInt(req.query.passengers, 10) || 1));

    if (!from || !to) {
      return res.redirect('/' + res.locals.locale + '/bilet-axtar');
    }
    if (from === to) {
      return res.redirect('/' + res.locals.locale + '/bilet-axtar?from=' + from + '&passengers=' + passengers);
    }

    const [fromStation, toStation] = await Promise.all([
      Station.findOne({ code: from }).lean(),
      Station.findOne({ code: to }).lean()
    ]);

    const results = await scheduleService.searchTrips(from, to, date);

    res.render('pages/results', {
      title: 'Reyslər',
      results,
      from,
      to,
      date,
      passengers,
      fromName: fromStation ? fromStation.name : from,
      toName: toStation ? toStation.name : to,
      dateText: h.azDate(date)
    });
  } catch (e) {
    next(e);
  }
});

router.get('/yer-secimi/:tripId', async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId).lean();
    if (!trip) return next();

    const from = String(req.query.from || (trip.stops[0] || {}).code || '');
    const to = String(req.query.to || (trip.stops[trip.stops.length - 1] || {}).code || '');
    const passengers = Math.min(config.rules.maxTicketsPerOrder, Math.max(1, parseInt(req.query.passengers, 10) || 1));

    const classMaps = (trip.classes || []).map((c) => scheduleService.buildSeatMap(trip, c.code)).filter(Boolean);

    const fromStop = trip.stops.find((s) => s.code === from) || trip.stops[0];
    const toStop = trip.stops.find((s) => s.code === to) || trip.stops[trip.stops.length - 1];

    res.render('pages/seats', {
      title: 'Yer seçimi',
      trip,
      classMaps,
      from,
      to,
      passengers,
      fromName: fromStop ? fromStop.name : '',
      toName: toStop ? toStop.name : ''
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== API ==================== */

router.get('/api/stations', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = { active: true };
    if (q) {
      const re = new RegExp(q.replace(/[^\w\u0400-\u04FFəğıöşçüƏĞIÖŞÇÜ]/g, ''), 'i');
      filter.$or = [{ name: re }, { nameEn: re }, { code: re }];
    }
    const stations = await Station.find(filter).sort({ order: 1 }).limit(80).lean();
    res.json({ ok: true, stations });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Stansiyalar yüklənmədi' });
  }
});

router.get('/api/trips', async (req, res) => {
  try {
    const from = String(req.query.from || '').toUpperCase();
    const to = String(req.query.to || '').toUpperCase();
    const date = req.query.date || h.todayISO();
    if (!from || !to) return res.status(400).json({ ok: false, message: 'Marşrut göstərilməyib' });
    const results = await scheduleService.searchTrips(from, to, date);
    res.json({ ok: true, date, from, to, results });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Reyslər yüklənmədi' });
  }
});

router.get('/api/trips/:tripId/seats', async (req, res) => {
  try {
    const payload = await scheduleService.buildTripPayload(req.params.tripId, req.query.class ? [req.query.class] : null);
    if (!payload) return res.status(404).json({ ok: false, message: 'Reys tapılmadı' });
    res.json({ ok: true, trip: payload.trip, maps: payload.maps });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Yer məlumatı yüklənmədi' });
  }
});

router.get('/api/timetable', async (req, res) => {
  try {
    const date = req.query.date || h.todayISO();
    const line = req.query.line || 'all';
    const rows = await scheduleService.buildTimetableRows(date, line);
    res.json({ ok: true, date, line, rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Cədvəl yüklənmədi' });
  }
});

module.exports = router;
