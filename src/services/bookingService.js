const dayjs = require('dayjs');
const Trip = require('../models/Trip');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Payment = require('../models/Payment');
const config = require('../config');
const { generateOrderNo, generatePnr, seededRandom, seatSort } = require('../utils/helpers');

/** Seat layout-u qurur: hanqı yerlər tutulub, hansı boşdur */
function buildSeatMap(trip, classCode) {
  const tripClass = (trip.classes || []).find((c) => c.code === classCode);
  if (!tripClass) return null;

  const capacity = tripClass.capacity || tripClass.rows * tripClass.seatsPerRow * tripClass.wagons;
  const rows = tripClass.rows;
  const perRow = tripClass.seatsPerRow;
  const letters = 'ABCDEFGHK'.slice(0, perRow).split('');

  // Deterministik "əvvəlcədən satılmış" yerlər (demo realizm üçün)
  const rand = seededRandom(`${trip.trainNumber}-${trip.date}-${classCode}`);
  const sold = new Set();

  (trip.soldSeats || [])
    .filter((k) => k.startsWith(`${classCode}:`))
    .forEach((k) => sold.add(k.split(':')[2]));

  const preSoldRatio = tripClass.layout === 'lux' ? 0.35 : 0.45;
  const allSeats = [];
  for (let r = 1; r <= rows; r++) {
    for (const l of letters) allSeats.push(`${r}${l}`);
  }
  allSeats.forEach((seat) => {
    if (rand() < preSoldRatio) sold.add(seat);
  });

  const wagons = [];
  for (let w = 1; w <= tripClass.wagons; w++) {
    const seats = [];
    for (let r = 1; r <= rows; r++) {
      for (const l of letters) {
        const seat = `${r}${l}`;
        seats.push({ seat, row: r, letter: l, taken: sold.has(seat) });
      }
    }
    wagons.push({ wagon: w, seats, takenCount: seats.filter((s) => s.taken).length });
  }

  return {
    code: tripClass.code,
    title: tripClass.title,
    price: tripClass.price,
    layout: tripClass.layout,
    rows,
    letters,
    wagons,
    capacity,
    freeCount: capacity - sold.size
  };
}

/** Seçilmiş yerlərin hələ də boş olduğunu yoxlayır */
async function validateSeats(tripId, selection) {
  const trip = await Trip.findById(tripId);
  if (!trip) return { ok: false, error: 'trip_not_found' };

  const soldSet = new Set(trip.soldSeats || []);
  const conflicts = [];

  for (const item of selection) {
    const key = `${item.classCode}:${item.wagon}:${item.seat}`;
    if (soldSet.has(key)) {
      conflicts.push(item.seat);
      continue;
    }
    // Deterministik ön-satış yoxlanışı
    const map = buildSeatMap(trip, item.classCode);
    if (!map) {
      conflicts.push(item.seat);
      continue;
    }
    const wagon = map.wagons.find((w) => w.wagon === Number(item.wagon));
    const seatObj = wagon && wagon.seats.find((s) => s.seat === String(item.seat));
    if (!seatObj) conflicts.push(item.seat);
  }

  if (conflicts.length) return { ok: false, error: 'seat_taken', conflicts };
  return { ok: true, trip };
}

/** Sifarişi (order) yaradır - ödənişdən ƏVVƏL, status = pending */
async function createPendingOrder({ user, trip, fromCode, toCode, passengers, contact, locale }) {
  const fromStop = trip.stops.find((s) => s.stationCode === fromCode);
  const toStop = trip.stops.find((s) => s.stationCode === toCode);
  if (!fromStop || !toStop) throw new Error('invalid_route');

  const departTime = fromStop.depart || fromStop.arrive;
  const arriveTime = toStop.arrive || toStop.depart;
  let duration = require('../utils/helpers').timeToMinutes(arriveTime) - require('../utils/helpers').timeToMinutes(departTime);
  if (duration < 0) duration += 1440;

  const enriched = passengers.map((p) => {
    const tc = trip.classes.find((c) => c.code === p.classCode);
    return {
      firstName: p.firstName,
      lastName: p.lastName,
      docType: p.docType,
      docNumber: p.docNumber,
      birthDate: p.birthDate ? new Date(p.birthDate) : undefined,
      phone: p.phone || contact.phone,
      email: p.email || contact.email,
      classCode: p.classCode,
      className: tc ? tc.title : p.classCode,
      wagon: Number(p.wagon),
      seat: String(p.seat),
      price: Number(p.price),
      pnr: generatePnr(),
      status: 'active'
    };
  });

  const amount = enriched.reduce((sum, p) => sum + p.price, 0);
  const serviceFee = 0;
  const total = amount + serviceFee;

  const order = await Order.create({
    orderNo: generateOrderNo(),
    user: user._id,
    trip: trip._id,
    trainNumber: trip.trainNumber,
    trainTitle: trip.trainTitle,
    date: trip.date,
    fromCode,
    fromName: fromStop.stationName,
    toCode,
    toName: toStop.stationName,
    departTime,
    arriveTime,
    durationMinutes: duration,
    passengers: enriched,
    contact,
    amount,
    serviceFee,
    total,
    status: 'pending',
    expiresAt: dayjs().add(20, 'minute').toDate(),
    locale: locale || 'az'
  });

  return order;
}

/** Ödəniş uğurlu olduqdan sonra: biletləri yarat + yerləri tut */
async function confirmOrderPayment(order, payment) {
  const trip = await Trip.findById(order.trip);

  if (trip) {
    const keys = order.passengers
      .filter((p) => p.status === 'active')
      .map((p) => `${p.classCode}:${p.wagon}:${p.seat}`);
    await Trip.updateOne({ _id: trip._id }, { $addToSet: { soldSeats: { $each: keys } } });
  }

  const tickets = [];
  for (const p of order.passengers) {
    if (p.status !== 'active') continue;
    const qrData = `ADY|${p.pnr}|${order.orderNo}|${order.trainNumber}|${order.date}|${order.fromCode}-${order.toCode}|${p.wagon}|${p.seat}`;
    const ticket = await Ticket.findOneAndUpdate(
      { pnr: p.pnr },
      {
        pnr: p.pnr,
        order: order._id,
        user: order.user,
        trip: order.trip,
        trainNumber: order.trainNumber,
        date: order.date,
        fromName: order.fromName,
        toName: order.toName,
        departTime: order.departTime,
        arrivalTime: order.arriveTime,
        passengerName: `${p.firstName} ${p.lastName}`,
        docNumber: p.docNumber,
        className: p.className,
        classCode: p.classCode,
        wagon: p.wagon,
        seat: p.seat,
        price: p.price,
        qrData,
        status: 'active'
      },
      { upsert: true, new: true }
    );
    tickets.push(ticket);
  }

  order.status = 'paid';
  order.paidAt = new Date();
  order.payment = payment ? payment._id : undefined;
  await order.save();

  return tickets;
}

/** Biletin qaytarılması (24 saatdan... real qaydalara uyğun) */
async function refundTicket(ticketId, userId) {
  const ticket = await Ticket.findOne({ _id: ticketId, user: userId });
  if (!ticket) return { ok: false, error: 'not_found' };
  if (ticket.status !== 'active') return { ok: false, error: 'already_refunded' };

  const order = await Order.findById(ticket.order);
  if (!order) return { ok: false, error: 'order_not_found' };

  const departure = dayjs(`${order.date} ${order.departTime}`);
  const minutesLeft = departure.diff(dayjs(), 'minute');
  if (minutesLeft < 5) return { ok: false, error: 'too_late' };

  const fee = config.rules.refundServiceFee;
  const refundAmount = Math.max(0, ticket.price - fee);

  ticket.status = 'refunded';
  ticket.refundedAt = new Date();
  ticket.refundFee = fee;
  await ticket.save();

  // Yeri boşalt
  await Trip.updateOne(
    { _id: order.trip },
    { $pull: { soldSeats: `${ticket.classCode}:${ticket.wagon}:${ticket.seat}` } }
  );

  order.refundAmount = (order.refundAmount || 0) + refundAmount;
  order.refundedAt = new Date();
  const stillActive = (order.passengers || []).filter((p) => p.pnr !== ticket.pnr && p.status === 'active').length;
  order.status = stillActive > 0 ? 'partially_refunded' : 'refunded';
  await order.save();

  return { ok: true, fee, refundAmount };
}

module.exports = {
  buildSeatMap,
  validateSeats,
  createPendingOrder,
  confirmOrderPayment,
  refundTicket
};
