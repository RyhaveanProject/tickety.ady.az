const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  pnr: { type: String, required: true, unique: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  /* Qonaq biletlərində istifadəçi hesabı olmur */
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  isGuest: { type: Boolean, default: false },
  guestEmail: { type: String, default: '' },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  trainNumber: { type: String, default: '' },
  trainTitle: { type: String, default: '' },
  date: { type: String, default: '' },
  fromCode: { type: String, default: '' },
  toCode: { type: String, default: '' },
  fromName: { type: String, default: '' },
  toName: { type: String, default: '' },
  departTime: { type: String, default: '' },
  arriveTime: { type: String, default: '' },
  passengerName: { type: String, default: '' },
  passengerDoc: { type: String, default: '' },
  wagon: { type: Number, default: 1 },
  seat: { type: Number, default: 1 },
  classCode: { type: String, default: '' },
  className: { type: String, default: '' },
  price: { type: Number, default: 0 },
  qrData: { type: String, default: '' },
  status: { type: String, enum: ['active', 'used', 'refunded', 'cancelled'], default: 'active', index: true },
  refundedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
