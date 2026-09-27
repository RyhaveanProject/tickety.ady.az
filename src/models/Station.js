const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true },
    nameEn: { type: String, default: '' },
    nameRu: { type: String, default: '' },
    region: { type: String, default: '' },
    // Abşeron xətti stansiyaları üçün sıra nömrəsi
    order: { type: Number, default: 0 },
    isHub: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

stationSchema.index({ name: 'text', nameEn: 'text', code: 'text' });

module.exports = mongoose.model('Station', stationSchema);
