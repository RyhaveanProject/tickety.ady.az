const crypto = require('crypto');

/* ---------- Kod / nömrə generatorları ---------- */
function randomDigits(len) {
  let s = '';
  while (s.length < len) s += Math.floor(Math.random() * 10);
  return s.slice(0, len);
}

function generateOrderNo() {
  const d = new Date();
  const stamp = String(d.getFullYear()).slice(2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  return 'ADY' + stamp + randomDigits(6);
}

function generatePnr() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i += 1) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

function generateTxId(prefix) {
  return (prefix || 'TX') + Date.now().toString(36).toUpperCase() + randomDigits(4);
}

/* ---------- Vaxt / tarix ---------- */
function timeToMinutes(t) {
  if (!t) return 0;
  const parts = String(t).split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function minutesToTime(m) {
  const total = ((m % 1440) + 1440) % 1440;
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return h + ' s ' + r + ' dəq';
  if (h) return h + ' s';
  return r + ' dəq';
}

function addMinutes(time, minutes) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

/* ---------- Pul ---------- */
function formatMoney(value, symbol) {
  const n = Number(value || 0);
  return n.toFixed(2) + ' ' + (symbol || '₼');
}

/* ---------- Kart ---------- */
function normalizeCardNumber(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 19);
}

function luhnValid(number) {
  const n = normalizeCardNumber(number);
  if (n.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = n.length - 1; i >= 0; i -= 1) {
    let d = parseInt(n[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function cardBrand(number) {
  const n = normalizeCardNumber(number);
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^(6|5[06-8])/.test(n)) return 'MilliKart';
  return 'Kart';
}

function maskCard(number) {
  const n = normalizeCardNumber(number);
  if (n.length < 4) return '••••';
  return '•••• •••• •••• ' + n.slice(-4);
}

function expiryValid(month, year) {
  const m = parseInt(month, 10);
  let y = parseInt(year, 10);
  if (!m || !y || m < 1 || m > 12) return false;
  if (y < 100) y += 2000;
  const end = new Date(y, m, 0, 23, 59, 59);
  return end.getTime() > Date.now();
}

/* ---------- Telefon / mətn ---------- */
function normalizePhone(value) {
  let v = String(value || '').replace(/[^\d+]/g, '');
  if (v.startsWith('00')) v = '+' + v.slice(2);
  if (/^0\d{9}$/.test(v)) v = '+994' + v.slice(1);
  if (/^\d{9}$/.test(v)) v = '+994' + v;
  return v;
}

function slugify(text) {
  const map = { ə: 'e', ı: 'i', ş: 's', ç: 'c', ğ: 'g', ö: 'o', ü: 'u', Ə: 'e', İ: 'i', Ş: 's', Ç: 'c', Ğ: 'g', Ö: 'o', Ü: 'u' };
  return String(text || '')
    .split('')
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function translit(text) {
  const map = { ə: 'e', ı: 'i', ş: 's', ç: 'c', ğ: 'g', ö: 'o', ü: 'u', Ə: 'E', İ: 'I', Ş: 'S', Ç: 'C', Ğ: 'G', Ö: 'O', Ü: 'U', ı: 'i' };
  return String(text || '')
    .split('')
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join('');
}

function truncate(text, len) {
  const s = String(text || '');
  return s.length > len ? s.slice(0, len - 1) + '…' : s;
}

/* ---------- Yer nömrələri ---------- */
function seatNumbers(count) {
  const arr = [];
  for (let i = 1; i <= count; i += 1) arr.push(i);
  return arr;
}

/* ---------- Tarix köməkçiləri ---------- */
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function isoAddDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayOfWeek(iso) {
  return new Date(iso + 'T00:00:00Z').getUTCDay(); // 0 = bazar
}

function azDate(iso) {
  const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
  const d = new Date(iso + 'T00:00:00Z');
  return d.getUTCDate() + ' ' + months[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

module.exports = {
  randomDigits,
  generateOrderNo,
  generatePnr,
  generateTxId,
  timeToMinutes,
  minutesToTime,
  formatDuration,
  addMinutes,
  formatMoney,
  normalizeCardNumber,
  luhnValid,
  cardBrand,
  maskCard,
  expiryValid,
  normalizePhone,
  slugify,
  translit,
  truncate,
  seatNumbers,
  todayISO,
  isoAddDays,
  dayOfWeek,
  azDate
};
