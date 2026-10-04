const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const savedCardSchema = new mongoose.Schema({
  cardId: { type: String, default: '' }, /* Unikal kart ID */
  masked: { type: String, default: '' }, /* Maskə kart nömrəsi (****1234) */
  number: { type: String, default: '' }, /* Şifrələnmiş kart nömrəsi */
  holder: { type: String, default: '' },
  expiry: { type: String, default: '' },
  brand: { type: String, default: '' }, /* visa, mastercard, etc */
  savedAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
});

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  middleName: { type: String, default: '', trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, default: '' },
  passport: { type: String, default: '' },
  birthDate: { type: Date },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  balance: { type: Number, default: 0, min: 0 },
  locale: { type: String, default: 'az' },
  managedFromEnv: { type: Boolean, default: false },
  passwordResetForced: { type: Boolean, default: false },
  resetCode: { type: String, default: '' },
  resetExpires: { type: Date },
  lastLoginAt: { type: Date },

  /* Saxlanılmış kartlar */
  savedCards: [savedCardSchema],
  defaultCardId: { type: String, default: '' }
}, { timestamps: true });

userSchema.virtual('fullName').get(function () {
  return [this.lastName, this.firstName, this.middleName].filter(Boolean).join(' ');
});

userSchema.virtual('initials').get(function () {
  return (this.firstName || '?').charAt(0) + (this.lastName || '?').charAt(0);
});

userSchema.methods.comparePasswordSources = function (plain) {
  return bcrypt.compare(plain, this.password || '');
};

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10);
};

userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
