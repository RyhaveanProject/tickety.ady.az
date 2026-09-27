const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const Station = require('../models/Station');
const Trip = require('../models/Trip');
const { searchTrips, ensureTripsForDate } = require('../services/scheduleService');
const { buildSeatMap } = require('../services/bookingService');

/* ==================== Bilet axtarışı səhifəsi ==================== */
router.get(
  ['/:lang(az|en|ru)/ticket-search', '/:lang(az|en|ru)/bilet-axtar', '/:lang(az|en|ru)/bilet-al'],
  async (req, res, next) => {
    try {
      const stations = await Station.find({ isActive: true }).sort({ order: 1 }).lean();
      const today = dayjs().format('YYYY-MM-DD');
      const maxDate = dayjs().add(10, 'day').format('YYYY-MM-DD');

      res.render('pages/ticket-search', {
        title: 'Qatara online bilet al | ADY',
        bodyClass: 'page-search',
        stations,
        today,
        maxDate,
        prefill: {
          from: req.query.from || '',
          to: req.query.to || '',
          date: req.query.date || today,
          passengers: parseInt(req.query.passengers || '1', 10)
        }
      });
    } catch (e) {
      next(e);
    }
  }
);

/* ==================== Nəticələr ==================== */
router.get(
  ['/:lang(az|en|ru)/reysler', '/:lang(az|en|ru)/trains'],
  async (req, res, next) => {
    try {
      const { from, to, date } = req.query;
      const passengers = Math.min(4, Math.max(1, parseInt(req.query.passengers || '1', 10)));

      if (!from || !to || !date) {
        return res.redirect(`/${req.locale || 'az'}/bilet-axtar`);
      }

      const stations = await Station.find({ isActive: true }).lean();
      const stationMap = {};
      stations.forEach((s) => (stationMap[s.code] = s));

      const results = await searchTrips({ from, to, date });
      const fromStation = stationMap[from];
      const toStation = stationMap[to];

      res.render('pages/results', {
        title: `${fromStation ? fromStation.name : from} → ${toStation ? toStation.name : to} | Biletlər`,
        bodyClass: 'page-results',
        results,
        from,
        to,
        date,
        passengers,
        fromName: fromStation ? fromStation.name : from,
        toName: toStation ? toStation.name : to,
        stations,
        dateText: dayjs(date).format('DD.MM.YYYY')
      });
    } catch (e) {
      next(e);
    }
  }
);

/* ==================== Yer seçimi ==================== */
router.get('/:lang(az|en|ru)/yer-secimi/:tripId', async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId).lean();
    if (!trip) return next();

    const from = req.query.from;
    const to = req.query.to;
    const passengers = Math.min(4, Math.max(1, parseInt(req.query.passengers || '1', 10)));

    const fromStop = trip.stops.find((s) => s.stationCode === from);
    const toStop = trip.stops.find((s) => s.stationCode === to);
    if (!fromStop || !toStop) return res.redirect(`/${req.locale || 'az'}/bilet-axtar`);

    const classMaps = (trip.classes || []).map((c) => buildSeatMap(trip, c.code));

    res.render('pages/seats', {
      title: 'Yer seçimi | ADY',
      bodyClass: 'page-seats',
      trip,
      classMaps,
      from,
      to,
      fromName: fromStop.stationName,
      toName: toStop.stationName,
      passengers,
      query: req.query
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== API: stansiyalar ==================== */
router.get('/api/stations', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const filter = { isActive: true };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { nameEn: { $regex: q, $options: 'i' } },
        { nameRu: { $regex: q, $options: 'i' } },
        { code: { $regex: q, $options: 'i' } }
      ];
    }
    const stations = await Station.find(filter).sort({ order: 1 }).limit(200).lean();
    res.json({ ok: true, stations });
  } catch (e) {
    next(e);
  }
});

/* ==================== API: reys axtarışı ==================== */
router.get('/api/trips', async (req, res, next) => {
  try {
    const { from, to, date } = req.query;
    if (!from || !to || !date) {
      return res.status(400).json({ ok: false, error: 'missing_params' });
    }
    const results = await searchTrips({ from, to, date });
    res.json({ ok: true, count: results.length, trips: results });
  } catch (e) {
    next(e);
  }
});

/* ==================== API: yer xəritəsi ==================== */
router.get('/api/trips/:tripId/seats', async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.tripId).lean();
    if (!trip) return res.status(404).json({ ok: false, error: 'trip_not_found' });

    const code = req.query.class;
    if (code) {
      const map = buildSeatMap(trip, code);
      if (!map) return res.status(404).json({ ok: false, error: 'class_not_found' });
      return res.json({ ok: true, seatMap: map });
    }

    const maps = (trip.classes || []).map((c) => buildSeatMap(trip, c.code));
    res.json({ ok: true, seatMaps: maps });
  } catch (e) {
    next(e);
  }
});

/* ==================== API: cədvəl ==================== */
router.get('/api/timetable', async (req, res, next) => {
  try {
    const date = req.query.date || dayjs().format('YYYY-MM-DD');
    const line = req.query.line;
    await ensureTripsForDate(date);
    const filter = { date, status: { $ne: 'cancelled' } };
    if (line) filter.line = line;
    const trips = await Trip.find(filter).sort({ departureTime: 1 }).lean();
    res.json({ ok: true, date, trips });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
