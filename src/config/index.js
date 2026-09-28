require('dotenv').config();

const bool = (v, def) => (v === undefined || v === '' ? def : String(v).toLowerCase() === 'true');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  siteUrl: process.env.SITE_URL || '',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ady_ticket',
  sessionSecret: process.env.SESSION_SECRET || 'ady-session-secret-change-in-render',

  useMemoryDb: bool(process.env.USE_MEMORY_DB, false),
  autoSeed: bool(process.env.AUTO_SEED, true),

  /* ---- Rəsmi admin girişi: yalnız Render Environment-dən ---- */
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@ady.az').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || 'Ady2026!Admin',
  /* İdarəçi ilk girişdən sonra şifrəni dəyişməlidir */
  adminTempPassword: bool(process.env.ADMIN_TEMP_PASSWORD, false),
  adminFirstName: process.env.ADMIN_FIRST_NAME || 'Sistem',
  adminLastName: process.env.ADMIN_LAST_NAME || 'İdarəçi',
  adminPhones: (process.env.ADMIN_PHONE || '').split(',').map((s) => s.trim()).filter(Boolean),

  /* ---- Canlı məlumat mənbəyi ---- */
  liveSourceUrl: process.env.LIVE_SOURCE_URL || 'https://ticket.ady.az',
  liveSyncEnabled: bool(process.env.LIVE_SYNC_ENABLED, true),
  liveSyncHours: parseInt(process.env.LIVE_SYNC_HOURS, 10) || 6,
  liveSyncOnBoot: bool(process.env.LIVE_SYNC_ON_BOOT, true),

  site: {
    name: 'ADY',
    fullName: 'Azərbaycan Dəmir Yolları QSC',
    brand: 'ady.az',
    supportPhone: '1822',
    supportPhoneLandline: '+994 12 499 50 05',
    supportEmail: 'info@ady.az',
    address: 'Bakı şəhəri, Dilarə Əliyeva küç. 230',
    currency: 'AZN',
    currencySymbol: '₼'
  },

  locales: ['az', 'en', 'ru'],
  defaultLocale: 'az',
  localeNames: { az: 'AZ', en: 'EN', ru: 'RU' },

  rules: {
    maxTicketsPerOrder: 4,
    salesOpenDaysBefore: 10,
    salesCloseHoursBefore: 3,
    freeRefundMinutes: 15,
    refundServiceFeePercent: 20
  },

  seatConfig: {
    standard: { wagonCount: 6, seatsPerWagon: 54 },
    business: { wagonCount: 2, seatsPerWagon: 36 },
    first: { wagonCount: 1, seatsPerWagon: 24 },
    coupe: { wagonCount: 4, seatsPerWagon: 36 },
    plazkart: { wagonCount: 6, seatsPerWagon: 54 }
  }
};

module.exports = config;
