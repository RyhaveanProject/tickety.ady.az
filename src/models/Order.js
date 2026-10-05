const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  middleName: { type: String, default: '', trim: true },
  birthDate: { type: String, default: '' },
  docType: { type: String, enum: ['id', 'passport'], default: 'id' },
  docNumber: { type: String, default: '' },
  phone: { type: String, default: '' },
  wagon: { type: Number, required: true },
  seat: { type: Number, required: true },
  classCode: { type: String, required: true },
  className: { type: String, default: '' },
  price: { type: Number, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNo: { type: String, required: true, unique: true, index: true },
  /* Qonaq sifarişlərində istifadəçi hesabı olmur — sifariş identifikatoru ilə idarə olunur */
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  isGuest: { type: Boolean, default: false, index: true },
  guestEmail: { type: String, default: '' },
  guestPhone: { type: String, default: '' },
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
  passengers: { type: [passengerSchema], default: [] },
  contactPhone: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  amount: { type: Number, required: true },
  serviceFee: { type: Number, default: 0 },
  total: { type: Number, required: true },
  method: { type: String, enum: ['card'], default: 'card' },
  status: {
    type: String,
    enum: [
      'pending_payment',
      'pending_admin',
      'awaiting_verification',
      'code_submitted',
      'paid',
      'confirmed',
      'cancelled',
      'refunded',
      'rejected',
      'expired'
    ],
    default: 'pending_payment',
    index: true
  },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  pnr: { type: String, default: '' },
  adminNote: { type: String, default: '' },
  confirmedAt: { type: Date },
  expiresAt: { type: Date }
}, { timestamps: true });

orderSchema.virtual('ticketCount').get(function () {
  return (this.passengers || []).length;
});

orderSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);
