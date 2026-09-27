const mongoose = require('mongoose');

const seatBlockSchema = new mongoose.Schema({
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  trainNumber: { type: String, default: '' },
  date: { type: String, default: '', index: true },
  wagon: { type: Number, required: true },
  seat: { type: Number, required: true },
  classCode: { type: String, required: true },
  reason: { type: String, default: '' },
  createdBy: { type: String, default: 'admin' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

seatBlockSchema.index({ trip: 1, wagon: 1, seat: 1, classCode: 1 }, { unique: true });

module.exports = mongoose.model('SeatBlock', seatBlockSchema);
