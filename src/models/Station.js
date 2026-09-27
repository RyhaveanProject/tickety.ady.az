const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  nameEn: { type: String, default: '' },
  nameRu: { type: String, default: '' },
  region: { type: String, default: '' },
  country: { type: String, enum: ['AZ', 'GE', 'TR', 'RU', 'other'], default: 'AZ', index: true },
  city: { type: String, default: '' },
  lat: { type: Number },
  lng: { type: Number },
  isHub: { type: Boolean, default: false },
  order: { type: Number, default: 100 },
  active: { type: Boolean, default: true },
  source: { type: String, default: 'seed' }
}, { timestamps: true });

stationSchema.index({ name: 'text', nameEn: 'text', code: 'text' });

module.exports = mongoose.model('Station', stationSchema);
