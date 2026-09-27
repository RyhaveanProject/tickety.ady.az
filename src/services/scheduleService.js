const dayjs = require('dayjs');
const Train = require('../models/Train');
const Trip = require('../models/Trip');
const Station = require('../models/Station');
const config = require('../config');
const { addMinutes, timeToMinutes, seededRandom } = require('../utils/helpers');

/** Verilən tarixdə qatarın işləyib-işləmədiyini yoxlayır */
function trainRunsOn(train, date) {
  const d = dayjs(date);
  const dow = d.day(); // 0=Bazar
  if (Array.isArray(train.weekdays) && train.weekdays.length) return train.weekdays.includes(dow);
  switch (train.daysType) {
    case 'work_days':
      return dow >= 1 && dow <= 5;
    case 'non_work_days':
      return dow === 0 || dow === 6;
    case 'weekend':
      return dow === 0 || dow === 6;
    case 'daily':
    default:
      return true;
  }
}

/** Train şablonundan konkret tarix üçün Trip yaradır */
async function buildTripFromTrain(train, date, stationMap) {
  const stops = train.stops.map((s, i) => {
    const st = stationMap[s.stationCode];
    const arrive = s.arrive ? addMinutes(s.arrive, (s.dayOffset || 0) * 0) : '';
    return {
      stationCode: s.stationCode,
      stationName: st ? st.name : s.stationCode,
      arrive: s.arrive || '',
      depart: s.depart || '',
      index: i
    };
  });

  const first = stops[0] || {};
  const classes = (train.classes || []).map((c) => ({
    code: c.code,
    title: c.title,
    price: c.basePrice,
    capacity: c.rows * c.seatsPerRow * c.wagons,
    wagons: c.wagons,
    rows: c.rows,
    seatsPerRow: c.seatsPerRow,
    layout: c.layout
  }));

  const doc = {
    trainNumber: train.number,
    trainTitle: train.title,
    type: train.type,
    line: train.line,
    date,
    dateObj: dayjs(date).startOf('day').toDate(),
    departureTime: first.depart || first.arrive || '',
    stops,
    classes,
    status: 'scheduled',
    soldSeats: []
  };

  const existing = await Trip.findOne({ trainNumber: train.number, date });
  if (existing) return existing;

  return Trip.create(doc);
}

/** Verilən tarix üçün bütün reysləri təmin edir (yoxdursa yaradır) */
async function ensureTripsForDate(date) {
  const trains = await Train.find({ isActive: true }).lean();
  const stations = await Station.find({ isActive: true }).lean();
  const stationMap = {};
  stations.forEach((s) => (stationMap[s.code] = s));

  const running = trains.filter((t) => trainRunsOn(t, date));
  const created = [];
  for (const t of running) {
    const trip = await buildTripFromTrain(t, date, stationMap);
    created.push(trip);
  }
  return created;
}

/** Stansiyalar arası məsafə əmsalı (tarif üçün) */
function stationDistanceFactor(fromIdx, toIdx, totalStops) {
  const span = Math.abs(toIdx - fromIdx);
  return span;
}

/**
 * Reys axtarışı: from/to/date üzrə uyğun reysləri tapır.
 */
async function searchTrips({ from, to, date, line }) {
  await ensureTripsForDate(date);

  const query = { date, status: { $ne: 'cancelled' } };
  if (line) query.line = line;

  const trips = await Trip.find(query).lean();
  const results = [];

  for (const trip of trips) {
    const stops = trip.stops || [];
    const fromStop = stops.find((s) => s.stationCode === from);
    const toStop = stops.find((s) => s.stationCode === to);
    if (!fromStop || !toStop) continue;
    if (toStop.index <= fromStop.index) continue; // yalnız irəli istiqamət

    const departTime = fromStop.depart || fromStop.arrive;
    const arriveTime = toStop.arrive || toStop.depart;
    let duration = timeToMinutes(arriveTime) - timeToMinutes(departTime);
    if (duration < 0) duration += 1440;

    const span = toStop.index - fromStop.index;

    const classes = (trip.classes || []).map((c) => {
      const price = Math.round(priceForSpan(c.price, span, trip.line) * 100) / 100;
      const used = (trip.soldSeats || []).filter(
        (k) => k.startsWith(`${c.code}:`)
      ).length;
      return {
        code: c.code,
        title: c.title,
        price,
        capacity: c.capacity,
        available: Math.max(0, c.capacity - used),
        wagons: c.wagons,
        rows: c.rows,
        seatsPerRow: c.seatsPerRow,
        layout: c.layout
      };
    });

    const minPrice = classes.length ? Math.min(...classes.map((c) => c.price)) : 0;

    results.push({
      tripId: trip._id.toString(),
      trainNumber: trip.trainNumber,
      trainTitle: trip.trainTitle,
      type: trip.type,
      line: trip.line,
      date: trip.date,
      departTime,
      arriveTime,
      duration,
      durationText: `${Math.floor(duration / 60)} s ${duration % 60} dəq`,
      fromName: fromStop.stationName || from,
      toName: toStop.stationName || to,
      fromCode: from,
      toCode: to,
      classes,
      minPrice,
      stopsCount: span
    });
  }

  results.sort((a, b) => timeToMinutes(a.departTime) - timeToMinutes(b.departTime));
  return results;
}

/** Stansiya sayına görə qiymət hesablanması */
function priceForSpan(basePrice, span, line) {
  if (line === 'absheron') {
    return basePrice; // Abşeron xəttində vahid zona tarifi
  }
  // Ölkədaxili: qiymət stansiya sayına (məsafəyə) görə
  const unit = Math.max(1, span);
  const raw = basePrice * unit;
  return Math.round(raw * 100) / 100;
}

module.exports = {
  trainRunsOn,
  ensureTripsForDate,
  searchTrips,
  buildTripFromTrain,
  priceForSpan
};
