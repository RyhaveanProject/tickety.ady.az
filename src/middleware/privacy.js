/* ==================== Məxfilik / anonimləşdirmə qatı ====================
   Məqsəd: saytın heç bir yerində (loglar, baza, cavab başlıqları) ziyarətçinin
   real İP ünvanı, cihaz/brauzer izi və ya digər identifikatorları saxlanılmasın
   və üzə çıxmasın. Bütün belə dəyərlər təsadüfi rəqəmlərlə əvəzlənir.          */
const crypto = require('crypto');

const IP_HEADERS = [
  'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'true-client-ip',
  'x-client-ip', 'x-cluster-client-ip', 'forwarded', 'forwarded-for',
  'x-forwarded', 'fastly-client-ip', 'x-appengine-user-ip', 'cf-ipcountry',
  'x-original-forwarded-for', 'via'
];

function randDigits(n) {
  let s = '';
  const buf = crypto.randomBytes(n);
  for (let i = 0; i < n; i += 1) s += String(buf[i] % 10);
  return s;
}

/* Təsadüfi, real olmayan İP (rəqəmlər hər sorğuda dəyişir) */
function randomIp() {
  const b = crypto.randomBytes(4);
  return [b[0] % 223 + 1, b[1], b[2], b[3] % 254 + 1].join('.');
}

/* Mətn içindəki İP, e-poçt, kart nömrəsi, telefon və tokenləri təsadüfi rəqəmlərlə əvəzləyir */
function scrub(value) {
  if (value === null || value === undefined) return value;
  let s = typeof value === 'string' ? value : (value instanceof Error ? (value.message || '') : (() => {
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  })());
  s = s
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, () => randomIp())
    .replace(/\b(?:[a-f0-9]{1,4}:){2,7}[a-f0-9]{0,4}\b/gi, () => 'fd' + randDigits(2) + '::' + randDigits(4))
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, () => 'user' + randDigits(6) + '@hidden')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, () => randDigits(16))
    .replace(/\+?\d{3}[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g, () => '+' + randDigits(12))
    .replace(/(sid|token|session|cookie|authorization)([=:"\s]+)[^\s;,"]+/gi, (m, k, sep) => k + sep + randDigits(12));
  return s;
}

/* 1) Hər sorğuda real İP və izləmə başlıqları silinir, req.ip təsadüfi dəyər qaytarır */
function anonymizeRequest(req, res, next) {
  IP_HEADERS.forEach((hdr) => { delete req.headers[hdr]; });
  const fakeIp = randomIp();
  const fakeId = randDigits(10);
  try {
    Object.defineProperty(req, 'ip', { configurable: true, get: () => fakeIp });
    Object.defineProperty(req, 'ips', { configurable: true, get: () => [] });
  } catch (e) { /* bəzi mühitlərdə yenidən təyin olunmur — sükutla keç */ }
  if (req.socket) {
    try { Object.defineProperty(req.socket, 'remoteAddress', { configurable: true, get: () => fakeIp }); } catch (e) { /* keç */ }
  }
  req.anonId = fakeId;
  /* Brauzer barmaq izi başlıqları — server tərəfdə istifadə olunmur */
  ['user-agent', 'sec-ch-ua', 'sec-ch-ua-platform', 'sec-ch-ua-mobile', 'sec-ch-ua-full-version-list',
    'sec-ch-ua-model', 'sec-ch-ua-arch', 'dnt', 'x-device-id', 'referer'].forEach((hdr) => {
    if (req.headers[hdr]) req.headers[hdr] = hdr === 'user-agent' ? 'Client/' + randDigits(4) : '';
  });
  next();
}

/* 2) Sərt cavab başlıqları: server/texnologiya izi gizlədilir, kənar izləmə bağlanır */
function hardenResponse(req, res, next) {
  res.removeHeader('X-Powered-By');
  res.setHeader('Server', 'srv-' + randDigits(4));
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy',
    'geolocation=(), camera=(), microphone=(), payment=(self), usb=(), interest-cohort=(), browsing-topics=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  /* Şəxsi bölmələr axtarış sistemlərinə və keşə düşmür */
  const p = req.path || '';
  if (/\/(admin|kabinet|odenis|odenis-gozleme|3d-tesdiq|ugur|bilet|bilet-goruntule|api)(\/|$)/.test(p)) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
}

/* 3) Gizli fayl/kəşfiyyat yollarına sorğular dərhal 404 alır (heç nə üzə çıxmır) */
const PROBE = /(^|\/)(\.env|\.git|\.svn|\.ht|\.DS_Store|package(-lock)?\.json|render\.yaml|server\.js|node_modules|src\/|scripts\/|seed\/|wp-admin|wp-login|phpmyadmin|\.sql|\.bak|\.log)(\/|$|\?)/i;
function blockProbes(req, res, next) {
  if (PROBE.test(req.path || '')) return res.status(404).type('text/plain').send('Not found');
  next();
}

/* 4) Logger: yalnız metod, yol (sorğu parametrləri olmadan), status, müddət — İP/UA yoxdur */
function privacyLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const line = '[req ' + randDigits(6) + '] ' + req.method + ' ' + String(req.path || '').replace(/[a-f0-9]{24}/gi, () => randDigits(8)) +
      ' ' + res.statusCode + ' ' + (Date.now() - start) + 'ms';
    process.stdout.write(line + '\n');
  });
  next();
}

/* 5) console.* çıxışları skrab olunur — təsadüfən də real məlumat loga düşmür */
function scrubConsole() {
  ['log', 'info', 'warn', 'error', 'debug'].forEach((m) => {
    const orig = console[m].bind(console);
    console[m] = function () {
      const args = Array.prototype.slice.call(arguments).map((a) => (typeof a === 'string' || a instanceof Error || typeof a === 'object') ? scrub(a) : a);
      return orig.apply(null, args);
    };
  });
}

/* Bazaya yazılan İP əvəzinə istifadə olunan təsadüfi dəyər */
function anonIp() { return randomIp(); }

module.exports = { anonymizeRequest, hardenResponse, blockProbes, privacyLogger, scrubConsole, scrub, anonIp, randDigits };
