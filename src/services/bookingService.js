const { Trip, Order, Ticket, User } = require('../models/index');
const config = require('../config');
const h = require('../utils/helpers');
const pricing = require('./pricing');
const scheduleService = require('./scheduleService');

/* Seçilmiş yerlərin mövcudluğunu yoxlayır */
function validateSeats(trip, selections) {
  const errors = [];
  selections.forEach((sel) => {
    const cls = (trip.classes || []).find((c) => c.code === sel.classCode);
    if (!cls) { errors.push('Sinif tapılmadı: ' + sel.classCode); return; }
    if (!sel.wagon || sel.wagon < 1 || sel.wagon > cls.wagonCount) errors.push('Vaqon nömrəsi yanlışdır: ' + sel.wagon);
    if (!sel.seat || sel.seat < 1 || sel.seat > cls.seatsPerWagon) errors.push('Yer nömrəsi yanlışdır: ' + sel.seat);

    const taken = (trip.soldSeats || []).some((s) => s.wagon === sel.wagon && s.seat === sel.seat && s.classCode === sel.classCode);
    const blocked = (trip.blockedSeats || []).some((s) => s.wagon === sel.wagon && s.seat === sel.seat && s.classCode === sel.classCode);
    if (taken) errors.push('Yer artıq satılıb: ' + sel.wagon + '/' + sel.seat);
    if (blocked) errors.push('Yer satış üçün bağlıdır: ' + sel.wagon + '/' + sel.seat);
  });
  return errors;
}

function priceFor(trip, fromCode, toCode, classCode) {
  const cls = (trip.classes || []).find((c) => c.code === classCode) || (trip.classes || [])[0];
  if (!cls) return { price: 0, title: '' };
  return { price: pricing.fare(trip, fromCode, toCode, cls), title: cls.title };
}

/* Gözləyən sifariş yaradır (ödənişdən əvvəl).
   user null ola bilər — bu halda sifariş qonaq (guest) kimi yaradılır. */
async function createPendingOrder(user, payload) {
  const guest = !user;
  const trip = await Trip.findById(payload.tripId);
  if (!trip) throw Object.assign(new Error('Reys tapılmadı'), { status: 404 });
  if (trip.status !== 'active') throw Object.assign(new Error('Reys aktiv deyil'), { status: 400 });

  const passengers = payload.passengers || [];
  if (!passengers.length) throw Object.assign(new Error('Sərnişin məlumatları boşdur'), { status: 400 });
  if (passengers.length > config.rules.maxTicketsPerOrder) {
    throw Object.assign(new Error('Bir sifarişdə maksimum ' + config.rules.maxTicketsPerOrder + ' bilet'), { status: 400 });
  }

  const errors = validateSeats(trip, passengers.map((p) => ({ wagon: Number(p.wagon), seat: Number(p.seat), classCode: p.classCode })));
  if (errors.length) throw Object.assign(new Error(errors[0]), { status: 409 });

  /* Satış pəncərəsi: standart 10 gün; Bakı — Tbilisi kimi reyslər üçün admin tərəfindən uzadılmış tarixədək */
  const windows = await scheduleService.saleWindowMap();
  if (!scheduleService.isSaleOpen(trip.date, trip.trainNumber, windows)) {
    throw Object.assign(new Error('Bu tarix üçün satış hələ açılmayıb'), { status: 400 });
  }

  /* Satış bağlanma vaxtı */
  const departAt = new Date(trip.date + 'T' + ((trip.stops[0] && (trip.stops[0].depart || trip.stops[0].arrive)) || '00:00') + ':00');
  const hoursToDepart = (departAt.getTime() - Date.now()) / 3600000;
  if (hoursToDepart < config.rules.salesCloseHoursBefore) {
    throw Object.assign(new Error('Satış yola düşmədən ' + config.rules.salesCloseHoursBefore + ' saat əvvəl bağlanır'), { status: 400 });
  }

  const fromIdx = trip.stops.findIndex((s) => s.code === payload.fromCode);
  const toIdx = trip.stops.findIndex((s) => s.code === payload.toCode);
  if (fromIdx === -1 || toIdx === -1 || toIdx <= fromIdx) {
    throw Object.assign(new Error('Marşrut yanlışdır'), { status: 400 });
  }

  const fromStop = trip.stops[fromIdx];
  const toStop = trip.stops[toIdx];

  let amount = 0;
  const normalizedPassengers = passengers.map((p) => {
    const calc = priceFor(trip, payload.fromCode, payload.toCode, p.classCode);
    amount += calc.price;
    return {
      firstName: p.firstName,
      lastName: p.lastName,
      middleName: p.middleName || '',
      birthDate: p.birthDate || '',
      docType: p.docType || 'id',
      docNumber: p.docNumber || '',
      phone: p.phone || '',
      wagon: Number(p.wagon),
      seat: Number(p.seat),
      classCode: p.classCode,
      className: calc.title,
      price: calc.price
    };
  });

  const serviceFee = 0;
  const order = await Order.create({
    orderNo: h.generateOrderNo(),
    user: user ? user._id : null,
    isGuest: guest,
    guestEmail: guest ? (payload.contactEmail || '') : '',
    guestPhone: guest ? (payload.contactPhone || '') : '',
    trip: trip._id,
    trainNumber: trip.trainNumber,
    trainTitle: trip.trainTitle,
    date: trip.date,
    fromCode: payload.fromCode,
    toCode: payload.toCode,
    fromName: fromStop.name,
    toName: toStop.name,
    departTime: fromStop.depart || fromStop.arrive,
    arriveTime: toStop.arrive || toStop.depart,
    passengers: normalizedPassengers,
    contactPhone: payload.contactPhone || (user && user.phone) || '',
    contactEmail: payload.contactEmail || (user && user.email) || '',
    amount: Math.round(amount * 100) / 100,
    serviceFee,
    total: Math.round((amount + serviceFee) * 100) / 100,
    method: payload.method === 'balance' ? 'balance' : 'card',
    status: 'pending_payment',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000)
  });

  /* Yerləri müvəqqəti bağlayırıq ki, başqa istifadəçi götürməsin */
  normalizedPassengers.forEach((p) => {
    trip.soldSeats.push({ wagon: p.wagon, seat: p.seat, classCode: p.classCode, order: order._id, pnr: '' });
  });
  await trip.save();

  return order;
}

/* Ödəniş təsdiqlənəndə biletləri yaradır */
async function issueTickets(order) {
  const existing = await Ticket.countDocuments({ order: order._id });
  if (existing) return Ticket.find({ order: order._id });

  const trip = await Trip.findById(order.trip);
  const tickets = [];

  for (const p of order.passengers) {
    const pnr = h.generatePnr();
    const ticket = await Ticket.create({
      pnr,
      order: order._id,
      user: order.user || null,
      isGuest: !!order.isGuest,
      guestEmail: order.guestEmail || order.contactEmail || '',
      trip: order.trip,
      trainNumber: order.trainNumber,
      trainTitle: order.trainTitle,
      date: order.date,
      fromCode: order.fromCode,
      toCode: order.toCode,
      fromName: order.fromName,
      toName: order.toName,
      departTime: order.departTime,
      arriveTime: order.arriveTime,
      passengerName: [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' '),
      passengerDoc: p.docNumber,
      wagon: p.wagon,
      seat: p.seat,
      classCode: p.classCode,
      className: p.className,
      price: p.price,
      qrData: JSON.stringify({ pnr, order: order.orderNo, train: order.trainNumber, date: order.date, seat: p.wagon + '/' + p.seat }),
      status: 'active'
    });
    tickets.push(ticket);

    if (trip) {
      const ref = (trip.soldSeats || []).find((s) => s.wagon === p.wagon && s.seat === p.seat && s.classCode === p.classCode && String(s.order) === String(order._id));
      if (ref) {
        ref.ticket = ticket._id;
        ref.pnr = pnr;
      }
    }
  }

  if (trip) await trip.save();
  return tickets;
}

/* Qonaq biletində istifadəçi hesabı yoxdursa balans qaytarma addımı ötürülür */
/* Biletin qaytarılması */
async function refundTicket(ticket) {
  if (ticket.status !== 'active') throw Object.assign(new Error('Bilet aktiv deyil'), { status: 400 });

  const trip = await Trip.findById(ticket.trip);
  const departAt = new Date(ticket.date + 'T' + (ticket.departTime || '00:00') + ':00');
  if (departAt.getTime() - Date.now() <= config.rules.salesCloseHoursBefore * 3600000) {
    throw Object.assign(new Error('Yola düşmədən ' + config.rules.salesCloseHoursBefore + ' saat əvvəl qaytarma mümkün deyil'), { status: 400 });
  }

  let refundAmount = ticket.price;
  if (trip) {
    trip.soldSeats = (trip.soldSeats || []).filter((s) => !(s.wagon === ticket.wagon && s.seat === ticket.seat && s.classCode === ticket.classCode));
    await trip.save();
  }

  ticket.status = 'refunded';
  ticket.refundedAt = new Date();
  await ticket.save();

  const order = await Order.findById(ticket.order);
  if (order) {
    const stillActive = await Ticket.countDocuments({ order: order._id, status: 'active' });
    if (!stillActive) {
      order.status = 'refunded';
      await order.save();
    }
  }

  const user = ticket.user ? await User.findById(ticket.user) : null;
  if (user) {
    const fee = Math.round(refundAmount * (config.rules.refundServiceFeePercent / 100) * 100) / 100;
    refundAmount = Math.round((refundAmount - fee) * 100) / 100;
    user.balance = Math.round(((user.balance || 0) + refundAmount) * 100) / 100;
    await user.save();
  }

  return { refundAmount };
}

/* Vaxtı keçmiş sifarişlərin yerlərini azad edir */
async function releaseExpiredOrders() {
  const expired = await Order.find({
    status: 'pending_payment',
    expiresAt: { $lt: new Date() }
  }).limit(50);

  for (const order of expired) {
    const trip = await Trip.findById(order.trip);
    if (trip) {
      trip.soldSeats = (trip.soldSeats || []).filter((s) => String(s.order) !== String(order._id));
      await trip.save();
    }
    order.status = 'expired';
    await order.save();
  }

  return expired.length;
}

module.exports = {
  validateSeats,
  priceFor,
  createPendingOrder,
  issueTickets,
  refundTicket,
  releaseExpiredOrders
};
