const mongoose = require('mongoose');

const tripStopSchema = new mongoose.Schema({
  code: { type: String, uppercase: true },
  name: { type: String, default: '' },
  arrive: { type: String, default: '' },
  depart: { type: String, default: '' },
  dayOffset: { type: Number, default: 0 },
  distanceKm: { type: Number, default: 0 }
}, { _id: false });

const tripClassSchema = new mongoose.Schema({
  code: { type: String, required: true },
  title: { type: String, required: true },
  wagonCount: { type: Number, default: 4 },
  seatsPerWagon: { type: Number, default: 54 },
  price: { type: Number, default: 0 }
}, { _id: false });

const seatRefSchema = new mongoose.Schema({
  wagon: { type: Number, required: true },
  seat: { type: Number, required: true },
  classCode: { type: String, required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  pnr: { type: String, default: '' }
}, { _id: false });

const tripSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, index: true },
  trainTitle: { type: String, default: '' },
  trainType: { type: String, default: 'passenger' },
  line: { type: String, enum: ['absheron', 'domestic', 'georgia', 'international'], default: 'domestic', index: true },
  source: { type: String, enum: ['scheduled', 'live', 'manual'], default: 'scheduled' },
  date: { type: String, required: true, index: true },
  stops: { type: [tripStopSchema], default: [] },
  classes: { type: [tripClassSchema], default: [] },
  soldSeats: { type: [seatRefSchema], default: [] },
  blockedSeats: { type: [seatRefSchema], default: [] },
  status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
  livePriceFrom: { type: Number, default: 0 },
  lastSyncedAt: { type: Date }
}, { timestamps: true });

tripSchema.index({ date: 1, trainNumber: 1 }, { unique: true });
tripSchema.index({ 'stops.code': 1, date: 1 });

tripSchema.virtual('departTime').get(function () {
  const s = this.stops && this.stops[0];
  return s ? (s.depart || s.arrive || '') : '';
});

tripSchema.virtual('arriveTime').get(function () {
  if (!this.stops || !this.stops.length) return '';
  const s = this.stops[this.stops.length - 1];
  return s.arrive || s.depart || '';
});

tripSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Trip', tripSchema);
