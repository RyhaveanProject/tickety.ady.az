require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  siteUrl: process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`,
  mongoUri: process.env.MONGODB_URI || '',
  useMemoryDb: String(process.env.USE_MEMORY_DB || 'true') === 'true',
  autoSeed: String(process.env.AUTO_SEED || 'true') === 'true',
  sessionSecret: process.env.SESSION_SECRET || 'ady-super-secret-key-change-me',
  paymentMode: process.env.PAYMENT_MODE || 'demo',
  demoOtp: process.env.DEMO_CARD_OTP || '1234',

  site: {
    name: 'ADY',
    fullName: 'Azərbaycan Dəmir Yolları QSC',
    brand: 'ady.az',
    supportPhone: '+994 12 499 45 45',
    supportEmail: 'info@ady.az',
    address: 'Bakı, Dilarə Əliyeva küç. 230',
    currency: 'AZN',
    currencySymbol: '₼'
  },

  locales: ['az', 'en', 'ru'],
  defaultLocale: 'az',

  // Bilet qaydaları (real saytdakı qaydalara uyğun)
  rules: {
    maxTicketsPerOrder: 4,
    salesOpenDaysBefore: 10,
    salesCloseHoursBefore: 3,
    freeRefundMinutes: 15,
    refundServiceFee: 20
  }
};

module.exports = config;
