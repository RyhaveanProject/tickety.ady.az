const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true },
  name: { type: String, default: '' },
  arrive: { type: String, default: '' },
  depart: { type: String, default: '' },
  dayOffset: { type: Number, default: 0 },
  distanceKm: { type: Number, default: 0 }
}, { _id: false });

const classSchema = new mongoose.Schema({
  code: { type: String, required: true },
  title: { type: String, required: true },
  wagonCount: { type: Number, default: 4 },
  seatsPerWagon: { type: Number, default: 54 },
  price: { type: Number, default: 0 },
  multiplier: { type: Number, default: 1 }
}, { _id: false });

const trainSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, trim: true, index: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['express', 'fast', 'passenger', 'suburban', 'international'], default: 'passenger' },
  line: { type: String, enum: ['absheron', 'domestic', 'georgia', 'international'], default: 'domestic', index: true },
  from: { type: String, required: true, uppercase: true },
  to: { type: String, required: true, uppercase: true },
  weekdays: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
  stops: { type: [stopSchema], default: [] },
  classes: { type: [classSchema], default: [] },
  basePrice: { type: Number, default: 0 },
  pricePerKm: { type: Number, default: 0.06 },
  active: { type: Boolean, default: true },
  /* Reysin hərəkət etdiyi tarix aralığı (YYYY-MM-DD; boş = məhdudiyyət yoxdur) */
  validFrom: { type: String, default: '' },
  validUntil: { type: String, default: '' },
  /* Bu tarixədək bilet satışı standart 10 günlük pəncərədən asılı olmadan açıqdır */
  advanceSaleUntil: { type: String, default: '' },
  source: { type: String, default: 'seed' },
  sourceUrl: { type: String, default: '' },
  lastSyncedAt: { type: Date }
}, { timestamps: true });

trainSchema.virtual('distanceKm').get(function () {
  if (!this.stops || !this.stops.length) return 0;
  return this.stops[this.stops.length - 1].distanceKm || 0;
});

trainSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Train', trainSchema);
