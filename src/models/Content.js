const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  excerpt: { type: String, default: '' },
  content: { type: String, default: '' },
  image: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  publishedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const pageSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  excerpt: { type: String, default: '' },
  content: { type: String, default: '' },
  group: { type: String, default: 'general' },
  order: { type: Number, default: 100 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const destinationSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  summary: { type: String, default: '' },
  content: { type: String, default: '' },
  image: { type: String, default: '' },
  stationCode: { type: String, default: '' },
  priceFrom: { type: Number, default: 0 },
  durationText: { type: String, default: '' },
  distanceKm: { type: Number, default: 0 },
  order: { type: Number, default: 100 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  subject: { type: String, default: '' },
  message: { type: String, required: true },
  handled: { type: Boolean, default: false }
}, { timestamps: true });

const subscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true }
}, { timestamps: true });

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  order: { type: Number, default: 100 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = {
  News: mongoose.model('News', newsSchema),
  Page: mongoose.model('Page', pageSchema),
  Destination: mongoose.model('Destination', destinationSchema),
  ContactMessage: mongoose.model('ContactMessage', contactMessageSchema),
  Subscriber: mongoose.model('Subscriber', subscriberSchema),
  Faq: mongoose.model('Faq', faqSchema),
  Setting: mongoose.model('Setting', settingSchema)
};
