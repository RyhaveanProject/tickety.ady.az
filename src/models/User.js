const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    finCode: { type: String, trim: true, uppercase: true, default: '' },
    docType: { type: String, enum: ['fin', 'passport', 'id', 'birth'], default: 'fin' },
    docNumber: { type: String, trim: true, default: '' },
    birthDate: { type: Date },
    balance: { type: Number, default: 0 },
    cardNumber: { type: String, default: '' },
    locale: { type: String, enum: ['az', 'en', 'ru'], default: 'az' },
    newsOptIn: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    resetToken: { type: String, default: '' },
    resetTokenExpires: { type: Date }
  },
  { timestamps: true }
);

userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
