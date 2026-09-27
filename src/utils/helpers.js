const crypto = require('crypto');
const dayjs = require('dayjs');
require('dayjs/locale/az');
require('dayjs/locale/ru');

/** Sifariş nömrəsi: ADY-260927-8F3K2 */
function generateOrderNo() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rnd = '';
  for (let i = 0; i < 5; i++) rnd += alphabet[crypto.randomInt(0, alphabet.length)];
  return `ADY-${dayjs().format('YYMMDD')}-${rnd}`;
}

/** Bilet kodu (PNR): 6 simvol */
function generatePnr() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rnd = '';
  for (let i = 0; i < 6; i++) rnd += alphabet[crypto.randomInt(0, alphabet.length)];
  return rnd;
}

/** Deterministik psevdo-təsadüfi (eyni gün/eyni qatar üçün eyni nəticə) */
function seededRandom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "HH:mm" + dəqiqə -> "HH:mm" */
function addMinutes(time, minutes) {
  const [h, m] = String(time).split(':').map(Number);
  const total = h * 60 + m + Number(minutes);
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function timeToMinutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
}

/** 145 -> "2 s 25 dəq" */
function formatDuration(minutes, lang = 'az') {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hWord = { az: 's', en: 'h', ru: 'ч' }[lang] || 's';
  const mWord = { az: 'dəq', en: 'min', ru: 'мин' }[lang] || 'dəq';
  if (h === 0) return `${m} ${mWord}`;
  if (m === 0) return `${h} ${hWord}`;
  return `${h} ${hWord} ${m} ${mWord}`;
}

function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCardNumber(num) {
  return String(num).replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
}

function maskCard(num) {
  const digits = String(num).replace(/\D/g, '');
  return '**** **** **** ' + digits.slice(-4);
}

function detectCardBrand(num) {
  const d = String(num).replace(/\D/g, '');
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^9/.test(d)) return 'MilliKart';
  if (/^6/.test(d)) return 'UnionPay';
  return 'Kart';
}

/** Luhn alqoritmi ilə kart nömrəsi yoxlanışı */
function isValidCardNumber(num) {
  const d = String(num).replace(/\D/g, '');
  if (d.length < 16 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function isValidExpiry(mmYY) {
  const m = String(mmYY).match(/^(\d{2})\s*\/?\s*(\d{2})$/);
  if (!m) return false;
  const month = parseInt(m[1], 10);
  const year = 2000 + parseInt(m[2], 10);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  return endOfMonth >= now;
}

/** AZ mobil nömrə formatı: +994XXXXXXXXX */
function normalizePhone(phone) {
  let d = String(phone || '').replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = '+994' + d.slice(1);
  if (!d.startsWith('+') && d.length === 9) d = '+994' + d;
  return d;
}

function truncate(str, len = 120) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function slugify(str) {
  const map = { ə: 'e', ğ: 'g', ş: 's', ç: 'c', ö: 'o', ü: 'u', ı: 'i', İ: 'i', Ə: 'e' };
  return String(str)
    .split('')
    .map((ch) => map[ch] || ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** PDF üçün: Helvetica şriftində olmayan hərfləri sadələşdirir */
function transliterate(str) {
  const map = {
    ə: 'e', Ə: 'E', ğ: 'g', Ğ: 'G', ş: 's', Ş: 'S', ç: 'c', Ç: 'C',
    ö: 'o', Ö: 'O', ü: 'u', Ü: 'U', ı: 'i', İ: 'I', '₼': 'AZN'
  };
  return String(str || '').split('').map((ch) => map[ch] || ch).join('');
}

/** Seat nömrəsi -> hərf-ədəd sırası üçün köməkçi */
function seatSort(a, b) {
  const pa = String(a).match(/(\d+)([A-Za-z]*)/);
  const pb = String(b).match(/(\d+)([A-Za-z]*)/);
  if (!pa || !pb) return String(a).localeCompare(String(b));
  const na = parseInt(pa[1], 10);
  const nb = parseInt(pb[1], 10);
  if (na !== nb) return na - nb;
  return (pa[2] || '').localeCompare(pb[2] || '');
}

module.exports = {
  generateOrderNo,
  generatePnr,
  seededRandom,
  addMinutes,
  timeToMinutes,
  formatDuration,
  formatMoney,
  formatCardNumber,
  maskCard,
  detectCardBrand,
  isValidCardNumber,
  isValidExpiry,
  normalizePhone,
  truncate,
  slugify,
  transliterate,
  seatSort
};
