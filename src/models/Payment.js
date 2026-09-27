const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'AZN' },
    method: { type: String, enum: ['card', 'balance', 'wallet', 'terminal'], default: 'card' },
    cardBrand: { type: String, default: '' },
    cardMask: { type: String, default: '' },
    holderName: { type: String, default: '' },
    status: { type: String, enum: ['initiated', 'otp_sent', 'success', 'failed', 'refunded'], default: 'initiated', index: true },
    otpCode: { type: String, default: '' },
    otpAttempts: { type: Number, default: 0 },
    errorMessage: { type: String, default: '' },
    ip: { type: String, default: '' },
    refundedAt: { type: Date },
    refundedAmount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
