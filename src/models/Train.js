const mongoose = require('mongoose');

/**
 * Train = qatar şablonu (cədvəl). Faktiki reyslər (Trip) bu şablondan yaradılır.
 */
const stopSchema = new mongoose.Schema(
  {
    stationCode: { type: String, required: true, uppercase: true },
    arrive: { type: String, default: '' }, // "HH:mm" (başlanğıc stansiya üçün boş)
    depart: { type: String, default: '' }, // "HH:mm"
    dayOffset: { type: Number, default: 0 } // gecə qatarları üçün
  },
  { _id: false }
);

const classSchema = new mongoose.Schema(
  {
    code: { type: String, required: true }, // seat | coupe | lux | business | second
    title: { type: String, required: true },
    titleEn: { type: String, default: '' },
    titleRu: { type: String, default: '' },
    pricePerStation: { type: Number, default: 1 }, // tarif vahidi (stansiyalar arası)
    basePrice: { type: Number, default: 0 }, // baza qiymət
    serviceFee: { type: Number, default: 0 },
    rows: { type: Number, default: 10 },
    seatsPerRow: { type: Number, default: 4 },
    wagons: { type: Number, default: 1 },
    layout: { type: String, default: 'sitting' } // sitting | coupe | lux
  },
  { _id: false }
);

const trainSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true },
    titleEn: { type: String, default: '' },
    titleRu: { type: String, default: '' },
    type: { type: String, enum: ['suburban', 'express', 'domestic', 'international'], default: 'domestic' },
    line: { type: String, enum: ['absheron', 'domestic', 'international'], default: 'domestic' },
    daysType: { type: String, enum: ['daily', 'work_days', 'non_work_days', 'weekend'], default: 'daily' },
    // Həftənin günləri (0=Bazar ... 6=Şənbə) - boşdursa daysType tətbiq olunur
    weekdays: { type: [Number], default: [] },
    stops: { type: [stopSchema], default: [] },
    classes: { type: [classSchema], default: [] },
    saleOpenDaysBefore: { type: Number, default: 10 },
    saleCloseHoursBefore: { type: Number, default: 3 },
    isActive: { type: Boolean, default: true },
    color: { type: String, default: '#00539b' },
    note: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Train', trainSchema);
