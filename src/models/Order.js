const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    docType: { type: String, enum: ['fin', 'passport', 'id', 'birth'], default: 'fin' },
    docNumber: { type: String, required: true },
    birthDate: { type: Date },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    classCode: { type: String, required: true },
    className: { type: String, default: '' },
    wagon: { type: Number, default: 1 },
    seat: { type: String, required: true },
    price: { type: Number, required: true },
    pnr: { type: String, required: true },
    status: { type: String, enum: ['active', 'refunded', 'used'], default: 'active' }
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
    trainNumber: { type: String, default: '' },
    trainTitle: { type: String, default: '' },
    date: { type: String, default: '' },
    fromCode: { type: String, default: '' },
    fromName: { type: String, default: '' },
    toCode: { type: String, default: '' },
    toName: { type: String, default: '' },
    departTime: { type: String, default: '' },
    arriveTime: { type: String, default: '' },
    durationMinutes: { type: Number, default: 0 },
    passengers: { type: [passengerSchema], default: [] },
    contact: {
      phone: { type: String, default: '' },
      email: { type: String, default: '' }
    },
    amount: { type: Number, required: true },
    serviceFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'AZN' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled', 'refunded', 'partially_refunded'],
      default: 'pending',
      index: true
    },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    refundAmount: { type: Number, default: 0 },
    expiresAt: { type: Date },
    locale: { type: String, default: 'az' }
  },
  { timestamps: true }
);

orderSchema.virtual('pnr').get(function () {
  return this.passengers && this.passengers.length ? this.passengers[0].pnr : '';
});

orderSchema.virtual('ticketCount').get(function () {
  return (this.passengers || []).filter((p) => p.status === 'active').length;
});

orderSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);
