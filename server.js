require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const config = require('./src/config');
const { connectDB } = require('./src/config/db');
const { lazyStore, attachMongoStore } = require('./src/config/sessionStore');
const { loadUser } = require('./src/middleware/auth');
const localeMiddleware = require('./src/middleware/locale');
const { notFound, errorHandler } = require('./src/middleware/errors');

const app = express();

/* ==================== Görünüş (View) mühiti ==================== */
app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

/* ==================== Təhlükəsizlik & ümumi middleware ==================== */
app.set('trust proxy', 1); // Render proxy arxasında işləyir

app.use(
  helmet({
    contentSecurityPolicy: false, // inline skriptlər (bilet/ödəniş səhifələri) üçün
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(config.sessionSecret));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use(
  '/public',
  express.static(path.join(__dirname, 'public'), { maxAge: config.nodeEnv === 'production' ? '7d' : 0 })
);
app.use('/favicon.ico', (req, res) => res.status(204).end());

/* ==================== Session ==================== */
// Cookie yalnız HTTPS üzərində (production + https SITE_URL) "secure" olur.
// Beləliklə Render-də təhlükəsiz, lokal http testlərində isə işlək qalır.
const isHttps = config.nodeEnv === 'production' && /^https:/i.test(config.siteUrl || '');

app.use(
  session({
    name: 'ady.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: lazyStore, // DB hazır olduqda real MongoStore-a keçir
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      maxAge: 30 * 24 * 3600 * 1000
    }
  })
);

/* ==================== Rate limit (giriş & ödəniş) ==================== */
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'too_many_requests', message: 'Çox sayda cəhd. Bir az sonra yenidən yoxlayın.' }
});
app.use(['/az/login', '/en/login', '/ru/login', '/az/qeydiyyat', '/en/register', '/ru/register'], authLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/payment', rateLimit({ windowMs: 10 * 60 * 1000, max: 60 }));

/* ==================== Dil + istifadəçi ==================== */
app.use(localeMiddleware);
app.use(loadUser);

/* ==================== Şablon üçün qlobal dəyişənlər ==================== */
app.use((req, res, next) => {
  res.locals.site = config.site;
  res.locals.rules = config.rules;
  res.locals.path = req.path;
  res.locals.flash = req.session.flash || null;
  res.locals.currentUrl = req.originalUrl;
  res.locals.urlPrefix = `/${req.locale || 'az'}`;
  res.locals.year = new Date().getFullYear();
  if (req.session.flash) delete req.session.flash;
  next();
});

/* ==================== Marşrutlar ==================== */
app.use('/', require('./src/routes/index'));
app.use('/', require('./src/routes/auth'));
app.use('/', require('./src/routes/search'));
app.use('/', require('./src/routes/booking'));
app.use('/', require('./src/routes/account'));
app.use('/', require('./src/routes/pages'));
app.use('/api', require('./src/routes/api'));
app.use('/', require('./src/routes/admin'));

/* ==================== Sağlamlıq yoxlanışı (Render üçün) ==================== */
app.get('/healthz', (req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString()
  });
});

/* ==================== Xətalar ==================== */
app.use(notFound);
app.use(errorHandler);

/* ==================== İşə salma ==================== */
async function start() {
  try {
    await connectDB();

    // Session anbarını real MongoDB kolleksiyasına bağla
    try {
      attachMongoStore(mongoose);
      console.log('[session] MongoStore aktivdir (sessions kolleksiyası).');
    } catch (e) {
      console.warn('[session] MongoStore qoşulmadı, yaddaş anbarı istifadə olunur:', e.message);
    }

    if (config.autoSeed) {
      try {
        const { runSeedIfEmpty } = require('./src/seed/seed');
        await runSeedIfEmpty();
      } catch (e) {
        console.error('[seed] Avtomatik seed alınmadı:', e.message);
      }
    }

    const server = app.listen(config.port, () => {
      console.log('\n🚆 ADY Ticket Clone işə düşdü');
      console.log(`   ➜ http://localhost:${config.port}`);
      console.log(`   ➜ Mühit: ${config.nodeEnv} | Ödəniş rejimi: ${config.paymentMode}\n`);
    });

    process.on('SIGTERM', () => {
      console.log('[server] SIGTERM alındı, bağlanır...');
      server.close(() => process.exit(0));
    });
    process.on('SIGINT', () => process.exit(0));
  } catch (err) {
    console.error('[server] İşə salına bilmədi:', err.message);
    process.exit(1);
  }
}

if (require.main === module) start();

module.exports = app;
