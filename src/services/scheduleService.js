const dayjs = require('dayjs');
const { Train, Trip, Station } = require('../models/index');
const config = require('../config');
const h = require('../utils/helpers');
const pricing = require('./pricing');

function isoDate(d) {
  return dayjs(d).format('YYYY-MM-DD');
}

function trainRunsOn(train, dateISO) {
  if (train.validFrom && dateISO < train.validFrom) return false;
  if (train.validUntil && dateISO > train.validUntil) return false;
  const wd = h.dayOfWeek(dateISO);
  return (train.weekdays || []).indexOf(wd) > -1;
}

/* Reys nömrəsi -> satışın açıq olduğu son tarix (standart 10 günlük pəncərədən uzun olanlar) */
async function saleWindowMap() {
  const rows = await Train.find({ active: true, advanceSaleUntil: { $nin: ['', null] } })
    .select('number advanceSaleUntil').lean();
  const map = {};
  rows.forEach((r) => { map[r.number] = r.advanceSaleUntil; });
  return map;
}

function isSaleOpen(dateISO, trainNumber, windows) {
  const standardMax = h.isoAddDays(h.todayISO(), config.rules.salesOpenDaysBefore);
  if (dateISO <= standardMax) return true;
  return !!(windows && windows[trainNumber] && dateISO <= windows[trainNumber]);
}

/* Tarix seçicilər üçün ən son satış tarixi */
async function maxSaleDate() {
  const standardMax = h.isoAddDays(h.todayISO(), config.rules.salesOpenDaysBefore);
  const windows = await saleWindowMap();
  return Object.keys(windows).reduce((m, k) => (windows[k] > m ? windows[k] : m), standardMax);
}

/* Qatar şablonu dəyişdikdə gələcək reysləri yeniləyir:
   satışı və bloku olmayanlar silinir (lazım olduqda yenidən yaradılır), qalanlarda yalnız qiymət yenilənir */
async function refreshFutureTrips(train) {
  const today = h.todayISO();
  const trips = await Trip.find({ trainNumber: train.number, date: { $gte: today } });
  let removed = 0;
  let repriced = 0;
  for (const trip of trips) {
    if (trip.source === 'manual') continue;
    const untouched = !(trip.soldSeats || []).length && !(trip.blockedSeats || []).length;
    if (untouched) {
      await Trip.deleteOne({ _id: trip._id });
      removed += 1;
      continue;
    }
    (trip.classes || []).forEach((c) => {
      const tc = (train.classes || []).find((x) => x.code === c.code);
      if (tc) c.price = tc.price;
    });
    await trip.save();
    repriced += 1;
  }
  return { removed, repriced };
}

/* Verilmiş tarix üçün qatar şablonlarından Trip sənədləri yaradır */
async function ensureTripsForDate(dateISO) {
  const trains = await Train.find({ active: true }).lean();
  const windows = await saleWindowMap();
  const existing = await Trip.find({ date: dateISO }).select('trainNumber').lean();
  const have = new Set(existing.map((t) => t.trainNumber));

  const toCreate = [];
  trains.forEach((train) => {
    if (have.has(train.number)) return;
    if (!trainRunsOn(train, dateISO)) return;
    /* Standart pəncərədən uzaq tarixlər üçün yalnız satışı uzadılmış reyslər yaradılır */
    if (dateISO > h.isoAddDays(h.todayISO(), config.rules.salesOpenDaysBefore) && !isSaleOpen(dateISO, train.number, windows)) return;
    toCreate.push({
      trainNumber: train.number,
      trainTitle: train.title,
      trainType: train.type,
      line: train.line,
      source: 'scheduled',
      date: dateISO,
      stops: (train.stops || []).map((s) => ({
        code: s.code,
        name: s.name,
        arrive: s.arrive,
        depart: s.depart,
        dayOffset: s.dayOffset || 0,
        distanceKm: s.distanceKm || 0
      })),
      classes: (train.classes || []).map((c) => ({
        code: c.code,
        title: c.title,
        wagonCount: c.wagonCount,
        seatsPerWagon: c.seatsPerWagon,
        price: c.price
      })),
      livePriceFrom: (train.classes && train.classes.length ? train.classes[0].price : 0)
    });
  });

  if (toCreate.length) {
    try {
      await Trip.insertMany(toCreate, { ordered: false });
    } catch (e) {
      /* paralel yaradılma hallarını susdururuq */
    }
  }

  return Trip.find({ date: dateISO, status: 'active' }).lean();
}

/* Marşrut üzrə reyslərin axtarışı */
async function searchTrips(from, to, dateISO) {
  const windows = await saleWindowMap();
  const standardMax = h.isoAddDays(h.todayISO(), config.rules.salesOpenDaysBefore);
  const latest = Object.keys(windows).reduce((m, k) => (windows[k] > m ? windows[k] : m), standardMax);
  if (dateISO > latest) return [];
  await ensureTripsForDate(dateISO);

  const trips = await Trip.find({
    date: dateISO,
    status: 'active',
    'stops.code': { $all: [from, to] }
  }).lean();

  const results = [];

  trips.forEach((trip) => {
    if (!isSaleOpen(dateISO, trip.trainNumber, windows)) return;
    const fromIdx = trip.stops.findIndex((s) => s.code === from);
    const toIdx = trip.stops.findIndex((s) => s.code === to);
    if (fromIdx === -1 || toIdx === -1 || toIdx <= fromIdx) return;

    const fromStop = trip.stops[fromIdx];
    const toStop = trip.stops[toIdx];
    const depart = fromStop.depart || fromStop.arrive;
    const arrive = toStop.arrive || toStop.depart;
    const distance = Math.max(1, (toStop.distanceKm || 0) - (fromStop.distanceKm || 0));

    let departMinutes = h.timeToMinutes(depart) + (fromStop.dayOffset || 0) * 1440;
    let arriveMinutes = h.timeToMinutes(arrive) + (toStop.dayOffset || 0) * 1440;
    while (arriveMinutes <= departMinutes) arriveMinutes += 1440;
    const duration = arriveMinutes - departMinutes;

    const classes = (trip.classes || []).map((c) => ({
      code: c.code,
      title: c.title,
      price: pricing.fare(trip, from, to, c)
    })).sort((a, b) => a.price - b.price);

    const soldCount = (trip.soldSeats || []).length;

    results.push({
      tripId: String(trip._id),
      trainNumber: trip.trainNumber,
      trainTitle: trip.trainTitle,
      line: trip.line,
      date: trip.date,
      departTime: depart,
      arriveTime: arrive,
      durationText: h.formatDuration(duration),
      stopsCount: toIdx - fromIdx,
      fromName: fromStop.name,
      toName: toStop.name,
      classes,
      minPrice: classes.length ? classes[0].price : 0,
      soldCount
    });
  });

  results.sort((a, b) => h.timeToMinutes(a.departTime) - h.timeToMinutes(b.departTime));
  return results;
}

/* Yer xəritəsi: vaqonlar üzrə sərbəst / tutulmuş yerlər */
function buildSeatMap(trip, classCode) {
  const cls = (trip.classes || []).find((c) => c.code === classCode) || (trip.classes || [])[0];
  if (!cls) return null;

  const cfg = config.seatConfig[cls.code] || { wagonCount: cls.wagonCount, seatsPerWagon: cls.seatsPerWagon };
  const wagonCount = cls.wagonCount || cfg.wagonCount;
  const seatsPerWagon = cls.seatsPerWagon || cfg.seatsPerWagon;

  const sold = new Set(
    (trip.soldSeats || [])
      .filter((s) => s.classCode === cls.code)
      .map((s) => s.wagon + '-' + s.seat)
  );
  const blocked = new Set(
    (trip.blockedSeats || [])
      .filter((s) => s.classCode === cls.code)
      .map((s) => s.wagon + '-' + s.seat)
  );

  const wagons = [];
  let freeCount = 0;
  let takenCount = 0;

  for (let w = 1; w <= wagonCount; w += 1) {
    const seats = [];
    for (let s = 1; s <= seatsPerWagon; s += 1) {
      const key = w + '-' + s;
      const isBlocked = blocked.has(key);
      const isSold = sold.has(key);
      const taken = isBlocked || isSold;
      if (taken) takenCount += 1; else freeCount += 1;
      seats.push({ seat: s, taken, blocked: isBlocked, sold: isSold });
    }
    wagons.push({ wagon: w, seats, takenCount: seats.filter((x) => x.taken).length });
  }

  return {
    code: cls.code,
    title: cls.title,
    price: cls.price,
    wagonCount,
    seatsPerWagon,
    capacity: wagonCount * seatsPerWagon,
    freeCount,
    takenCount,
    wagons
  };
}

async function buildTripPayload(tripId, classCodes) {
  const trip = await Trip.findById(tripId).lean();
  if (!trip) return null;
  const maps = (classCodes || (trip.classes || []).map((c) => c.code))
    .map((code) => buildSeatMap(trip, code))
    .filter(Boolean);
  return { trip, maps };
}

/* Cədvəl sətirləri */
async function buildTimetableRows(dateISO, line, dayType) {
  const trips = await ensureTripsForDate(dateISO);
  const rows = [];

  trips.forEach((trip) => {
    if (line && line !== 'all' && trip.line !== line) return;
    const first = trip.stops[0];
    const last = trip.stops[trip.stops.length - 1];
    if (!first || !last) return;
    const stopMap = {};
    (trip.stops || []).forEach((s) => {
      stopMap[s.code] = { depart: s.depart || '', arrive: s.arrive || '', name: s.name || '' };
    });
    rows.push({
      number: trip.trainNumber,
      title: trip.trainTitle,
      line: trip.line,
      from: first.name,
      to: last.name,
      depart: first.depart || first.arrive,
      arrive: last.arrive || last.depart,
      minPrice: (trip.classes || []).reduce((m, c) => (m === 0 || c.price < m ? c.price : m), 0),
      fromCode: first.code,
      toCode: last.code,
      stopMap,
      stopsCount: trip.stops.length
    });
  });

  rows.sort((a, b) => h.timeToMinutes(a.depart) - h.timeToMinutes(b.depart));
  return rows;
}

/* Ana səhifə üçün qruplaşdırılmış cədvəl */
async function homeTimetable(dateISO) {
  const rows = await buildTimetableRows(dateISO);
  return {
    absheron: rows.filter((r) => r.line === 'absheron'),
    domestic: rows.filter((r) => r.line === 'domestic'),
    georgia: rows.filter((r) => r.line === 'georgia'),
    international: rows.filter((r) => r.line === 'international')
  };
}

module.exports = {
  saleWindowMap,
  isSaleOpen,
  maxSaleDate,
  refreshFutureTrips,
  ensureTripsForDate,
  searchTrips,
  buildSeatMap,
  buildTripPayload,
  buildTimetableRows,
  homeTimetable,
  trainRunsOn,
  isoDate
};
