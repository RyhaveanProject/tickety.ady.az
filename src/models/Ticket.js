const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    pnr: { type: String, required: true, unique: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
    trainNumber: { type: String, default: '' },
    date: { type: String, default: '' },
    fromName: { type: String, default: '' },
    toName: { type: String, default: '' },
    departTime: { type: String, default: '' },
    arrivalTime: { type: String, default: '' },
    passengerName: { type: String, default: '' },
    docNumber: { type: String, default: '' },
    className: { type: String, default: '' },
    classCode: { type: String, default: '' },
    wagon: { type: Number, default: 1 },
    seat: { type: String, default: '' },
    price: { type: Number, default: 0 },
    qrData: { type: String, default: '' }, // QR kod üçün mətn
    qrImage: { type: String, default: '' }, // base64 data URL
    status: { type: String, enum: ['active', 'used', 'refunded'], default: 'active', index: true },
    refundedAt: { type: Date },
    refundFee: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ticket', ticketSchema);
