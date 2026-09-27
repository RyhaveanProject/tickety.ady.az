const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');

const config = require('./src/config');
const { connectDatabase, isConnected } = require('./src/config/db');
const { buildSessionMiddleware, attachMongoStore } = require('./src/config/sessionStore');
const localeMiddleware = require('./src/middleware/locale');
const { loadUser } = require('./src/middleware/auth');
const { notFound, errorHandler } = require('./src/middleware/errors');

const app = express();

/* ==================== Baza görünüşü ==================== */
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

/* ==================== Təhlükəsizlik / log ==================== */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
}

/* ==================== Gövdə / statik ==================== */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

app.use('/public', express.static(path.join(__dirname, 'public'), {
  maxAge: config.nodeEnv === 'production' ? '7d' : 0
}));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

/* ==================== Sessiya ==================== */
const sessionMw = buildSessionMiddleware();
app.use(sessionMw);

/* ==================== Limitlər ==================== */
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Çox sayda cəhd. Bir az sonra yenidən yoxlayın.' }
});
const payLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Çox sayda sorğu. Bir az sonra yenidən yoxlayın.' }
});

app.use('/api/auth', authLimiter);
app.use('/api/payment', payLimiter);
app.use('/api/balance', payLimiter);

/* ==================== Lokalizasiya + istifadəçi ==================== */
const { SOCIALS, APPS } = require('./src/config/social');

app.use(localeMiddleware);
app.use(loadUser);

/* Sosial platformalar və tətbiq keçidləri bütün görünüşlərə ötürülür */
app.use((req, res, next) => {
  res.locals.socials = SOCIALS;
  res.locals.apps = APPS;
  next();
});

/* XHR aşkarlanması */
app.use((req, res, next) => {
  req.xhr = req.get('X-Requested-With') === 'XMLHttpRequest';
  next();
});

/* ==================== Sağlamlıq ==================== */
app.get('/healthz', (req, res) => {
  res.json({ ok: true, db: isConnected() ? 'connected' : 'disconnected', uptime: Math.round(process.uptime()) });
});

/* ==================== Marşrutlar ==================== */
const authRoutes = require('./src/routes/auth');
const indexRoutes = require('./src/routes/index');
const searchRoutes = require('./src/routes/search');
const bookingRoutes = require('./src/routes/booking');
const accountRoutes = require('./src/routes/account');
const pageRoutes = require('./src/routes/pages');
const apiRoutes = require('./src/routes/api');
const adminRoutes = require('./src/routes/admin');

/* API marşrutları dil prefiksindən asılı deyil */
app.use('/', authRoutes);
app.use('/', apiRoutes);
app.use('/', bookingRoutes);
app.use('/', accountRoutes);
app.use('/', searchRoutes);

/* İdarəetmə API-si dil prefiksindən asılı deyil */
app.use('/api/admin', adminRoutes.api);

/* Səhifə marşrutları dil prefiksi ilə */
const localesPattern = config.locales.join('|');
app.get('/', (req, res) => {
  const locale = req.cookies.locale && config.locales.indexOf(req.cookies.locale) > -1 ? req.cookies.locale : config.defaultLocale;
  res.redirect('/' + locale);
});

app.use('/:lang(' + localesPattern + ')', (req, res, next) => {
  const lang = req.params.lang;
  if (config.locales.indexOf(lang) > -1 && (req.query.lang !== lang)) {
    res.cookie('locale', lang, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax' });
    req.locale = lang;
    res.locals.locale = lang;
    res.locals.t = function () {
      const { translate } = require('./src/config/i18n');
      return translate.apply(null, [lang].concat(Array.prototype.slice.call(arguments)));
    };
    if (req.session) req.session.locale = lang;
  }
  next();
});

/* İdarəetmə paneli səhifələri (dil prefiksi ilə) */
app.use('/:lang(' + localesPattern + ')/admin', adminRoutes.pages);

app.use('/:lang(' + localesPattern + ')', authRoutes);
app.use('/:lang(' + localesPattern + ')', searchRoutes);
app.use('/:lang(' + localesPattern + ')', bookingRoutes);
app.use('/:lang(' + localesPattern + ')', accountRoutes);
app.use('/:lang(' + localesPattern + ')', pageRoutes);
app.use('/:lang(' + localesPattern + ')', indexRoutes);

/* ==================== Xətalar ==================== */
app.use(notFound);
app.use(errorHandler);

/* ==================== Sinxronizasiya planlayıcısı ==================== */
let syncTimer = null;
function scheduleSync() {
  if (!config.liveSyncEnabled) return;
  const hours = Math.max(1, config.liveSyncHours);
  clearInterval(syncTimer);
  syncTimer = setInterval(async () => {
    try {
      const { runSync } = require('./src/services/liveSyncService');
      const scheduleService = require('./src/services/scheduleService');
      const h = require('./src/utils/helpers');
      await runSync('timer');
      await scheduleService.ensureTripsForDate(h.todayISO());
    } catch (e) {
      console.warn('[sync] avtomatik sinxronizasiya alınmadı:', e.message);
    }
  }, hours * 60 * 60 * 1000);
}

/* ==================== Başlanğıc ==================== */
async function start() {
  try {
    await connectDatabase();
  } catch (e) {
    console.error('[start] MongoDB qoşulması alınmadı:', e.message);
  }

  if (sessionMw.__store) attachMongoStore(sessionMw.__store, app);

  if (config.autoSeed && isConnected()) {
    try {
      const { seedAll } = require('./src/seed/seed');
      await seedAll({ force: false });
    } catch (e) {
      console.warn('[start] ilkin məlumat yazıla bilmədi:', e.message);
    }
  }

  /* ADY məzmunu və idarəçi hesabı — ilkin yazılışdan sonra tətbiq olunur */
  if (isConnected()) {
    try {
      const { bootstrap } = require('./src/seed/bootstrap');
      await bootstrap();
    } catch (e) {
      console.warn('[start] ADY məzmunu hazırlanmadı:', e.message);
    }
  }

  if (config.liveSyncOnBoot && isConnected()) {
    setTimeout(async () => {
      try {
        const { runSync } = require('./src/services/liveSyncService');
        const scheduleService = require('./src/services/scheduleService');
        const h = require('./src/utils/helpers');
        await runSync('boot');
        await scheduleService.ensureTripsForDate(h.todayISO());
        console.log('[sync] başlanğıc sinxronizasiyası tamamlandı');
      } catch (e) {
        console.warn('[sync] başlanğıc sinxronizasiyası alınmadı:', e.message);
      }
    }, 4000);
  }

  /* Yerləri vaxtı keçmiş sifarişlərdən azad et */
  setInterval(async () => {
    if (!isConnected()) return;
    try {
      const bookingService = require('./src/services/bookingService');
      await bookingService.releaseExpiredOrders();
    } catch (e) { /* susdurulur */ }
  }, 5 * 60 * 1000);

  scheduleSync();

  const port = process.env.PORT || config.port;
  app.listen(port, () => {
    console.log('ADY bilet portalı işə düşdü — port ' + port);
    console.log('Mühit: ' + config.nodeEnv + ' | Canlı mənbə: ' + config.liveSourceUrl);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
module.exports.start = start;
