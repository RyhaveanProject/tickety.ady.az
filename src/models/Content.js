const mongoose = require('mongoose');

/* ============ Xəbərlər ============ */
const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    titleEn: { type: String, default: '' },
    titleRu: { type: String, default: '' },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    image: { type: String, default: '' },
    sourceUrl: { type: String, default: '' },
    publishedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

/* ============ Səhifələr (qaydalar / tariflər / mətn səhifələri) ============ */
const pageSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    category: {
      type: String,
      enum: ['rules', 'tariffs', 'info', 'legal', 'destination'],
      default: 'info'
    },
    title: { type: String, required: true },
    titleEn: { type: String, default: '' },
    titleRu: { type: String, default: '' },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' }, // HTML
    image: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

/* ============ Populyar istiqamətlər ============ */
const destinationSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    titleEn: { type: String, default: '' },
    titleRu: { type: String, default: '' },
    summary: { type: String, default: '' },
    content: { type: String, default: '' },
    image: { type: String, default: '' },
    stationCode: { type: String, default: '' },
    priceFrom: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

/* ============ Əlaqə mesajları ============ */
const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    subject: { type: String, default: '' },
    message: { type: String, required: true },
    status: { type: String, enum: ['new', 'read', 'answered'], default: 'new' },
    ip: { type: String, default: '' }
  },
  { timestamps: true }
);

/* ============ Abunəçilər ============ */
const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    locale: { type: String, default: 'az' }
  },
  { timestamps: true }
);

/* ============ Tənzimləmələr (key-value) ============ */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: '' },
    description: { type: String, default: '' }
  },
  { timestamps: true }
);

/* ============ FAQ ============ */
const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

/* ============ Endirim / Promo kodlar ============ */
const promoCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    percent: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    maxUses: { type: Number, default: 100 },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = {
  News: mongoose.model('News', newsSchema),
  Page: mongoose.model('Page', pageSchema),
  Destination: mongoose.model('Destination', destinationSchema),
  ContactMessage: mongoose.model('ContactMessage', contactSchema),
  Subscriber: mongoose.model('Subscriber', subscriberSchema),
  Setting: mongoose.model('Setting', settingSchema),
  Faq: mongoose.model('Faq', faqSchema),
  PromoCode: mongoose.model('PromoCode', promoCodeSchema)
};
