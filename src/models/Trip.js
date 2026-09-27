const mongoose = require('mongoose');

const tripStopSchema = new mongoose.Schema(
  {
    stationCode: { type: String, required: true, uppercase: true },
    stationName: { type: String, default: '' },
    arrive: { type: String, default: '' },
    depart: { type: String, default: '' },
    index: { type: Number, default: 0 }
  },
  { _id: false }
);

const tripClassSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    title: { type: String, required: true },
    price: { type: Number, required: true },
    capacity: { type: Number, default: 40 },
    wagons: { type: Number, default: 1 },
    rows: { type: Number, default: 10 },
    seatsPerRow: { type: Number, default: 4 },
    layout: { type: String, default: 'sitting' }
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    trainNumber: { type: String, required: true, index: true },
    trainTitle: { type: String, default: '' },
    type: { type: String, default: 'domestic' },
    line: { type: String, default: 'domestic' },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    dateObj: { type: Date, required: true, index: true },
    departureTime: { type: String, default: '' },
    stops: { type: [tripStopSchema], default: [] },
    classes: { type: [tripClassSchema], default: [] },
    status: { type: String, enum: ['scheduled', 'cancelled', 'departed'], default: 'scheduled' },
    soldSeats: { type: [String], default: [] } // "class:wagon:seat"
  },
  { timestamps: true }
);

tripSchema.index({ trainNumber: 1, date: 1 }, { unique: true });
tripSchema.index({ 'stops.stationCode': 1, date: 1 });

module.exports = mongoose.model('Trip', tripSchema);
