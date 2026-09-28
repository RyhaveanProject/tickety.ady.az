/* ==========================================================================
   ADY portalının qrafik elementlərinin generasiyası (təmiz vektor, emoji yox).
   Rəsmi saytın korporativ rəngləri: tünd göy #00539b / #003c73, qızılı #f2a900
   Çıxış: public/assets/ady/*.svg  və  public/assets/logo.svg / logo-white.svg
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'assets', 'ady');
const ROOT = path.join(__dirname, '..', 'public', 'assets');
fs.mkdirSync(OUT, { recursive: true });

const NAVY = '#00539b';
const NAVY_DARK = '#003c73';
const GOLD = '#f2a900';
const LIGHT = '#eef4fa';

function write(file, svg, dir) {
  fs.writeFileSync(path.join(dir || OUT, file), svg.trim() + '\n', 'utf8');
  return file;
}

function header(w, h) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img">';
}

/* ---------------- Loqo ------------------------------------------------ */
function logo(bg, fg, accent, letters) {
  const w = 220; const h = 56;
  return [
    header(w, h),
    '<defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="' + NAVY + '"/><stop offset="1" stop-color="' + NAVY_DARK + '"/></linearGradient></defs>',
    '<rect x="0" y="0" width="56" height="56" rx="10" fill="url(#lg)"/>',
    '<g fill="none" stroke="' + GOLD + '" stroke-width="2.4" stroke-linecap="round">',
    '<circle cx="28" cy="26" r="9"/>',
    '<path d="M28 17v-5M28 40v-5M19 26h-5M42 26h-5"/>',
    '<path d="M21.6 19.6 18 16M34.4 19.6 38 16M21.6 32.4 18 36M34.4 32.4 38 36"/>',
    '</g>',
    '<circle cx="28" cy="26" r="3.6" fill="' + GOLD + '"/>',
    '<text x="28" y="50" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="7.5" font-weight="700" fill="#ffffff" letter-spacing="0.8">ADY</text>',
    '<text x="68" y="26" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="700" fill="' + fg + '">' + letters + '</text>',
    '<text x="68" y="43" font-family="Arial,Helvetica,sans-serif" font-size="10.5" fill="' + accent + '">Azərbaycan Dəmir Yolları</text>',
    '</svg>'
  ].join('');
}

write('logo.svg', logo(NAVY, NAVY_DARK, '#5b6b7b', 'ADY'), ROOT);
write('logo-white.svg', logo(NAVY, '#ffffff', '#cddced', 'ADY'), ROOT);
write('ady-logo.svg', logo(NAVY, NAVY_DARK, '#5b6b7b', 'ADY'));

/* ---------------- Bannerlər (geniş mənzərə) --------------------------- */
function scene(title, subtitle, variant) {
  const w = 1440; const h = 480;
  const sky = variant === 'night' ? '#062b4d' : (variant === 'sunset' ? '#0b4a7d' : NAVY_DARK);
  const gnd = variant === 'night' ? '#03203a' : '#002a52';
  return [
    header(w, h),
    '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0" stop-color="' + sky + '"/><stop offset="1" stop-color="' + gnd + '"/></linearGradient>',
    '<linearGradient id="rail" x1="0" y1="0" x2="1" y2="0">',
    '<stop offset="0" stop-color="' + GOLD + '" stop-opacity="0.15"/><stop offset="1" stop-color="' + GOLD + '" stop-opacity="0.75"/></linearGradient></defs>',
    '<rect width="' + w + '" height="' + h + '" fill="url(#sky)"/>',
    '<circle cx="1180" cy="110" r="58" fill="' + GOLD + '" opacity="0.85"/>',
    '<path d="M0 340 L180 250 L320 320 L470 210 L620 320 L780 240 L930 330 L1080 250 L1240 330 L1440 260 L1440 480 L0 480 Z" fill="#00243f" opacity="0.85"/>',
    '<path d="M0 380 L220 310 L400 372 L560 300 L740 380 L900 320 L1090 390 L1260 330 L1440 380 L1440 480 L0 480 Z" fill="#001c33"/>',
    '<g stroke="url(#rail)" stroke-width="6" fill="none"><path d="M-20 470 L1460 400"/><path d="M-20 478 L1460 408"/></g>',
    '<g transform="translate(150,300)">',
    '<rect x="0" y="0" width="430" height="96" rx="18" fill="#f4f8fc"/>',
    '<rect x="0" y="0" width="430" height="30" rx="14" fill="' + NAVY + '"/>',
    '<rect x="22" y="40" width="66" height="34" rx="6" fill="#bcd4e8"/>',
    '<rect x="104" y="40" width="66" height="34" rx="6" fill="#bcd4e8"/>',
    '<rect x="186" y="40" width="66" height="34" rx="6" fill="#bcd4e8"/>',
    '<rect x="268" y="40" width="66" height="34" rx="6" fill="#bcd4e8"/>',
    '<rect x="350" y="40" width="60" height="34" rx="6" fill="#bcd4e8"/>',
    '<rect x="408" y="6" width="16" height="20" rx="4" fill="' + GOLD + '"/>',
    '</g>',
    '<text x="70" y="140" font-family="Arial,Helvetica,sans-serif" font-size="54" font-weight="700" fill="#ffffff">' + title + '</text>',
    '<text x="72" y="188" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="#bfd6ea">' + subtitle + '</text>',
    '</svg>'
  ].join('');
}

write('banner-1.svg', scene('Qatarla səyahət', 'Bakıdan Gəncəyə, Sumqayıta və Tbilisiyə onlayt bilet', 'day'));
write('banner-2.svg', scene('ADY ilə Azərbaycanı kəşf et', 'Populyar istiqamətlər və gediş haqqı tarifləri', 'sunset'));
write('banner-3.svg', scene('Elektron bilet', 'QR kodlu bilet telefonunuzda, kağız çap tələb olunmur', 'night'));

/* ---------------- İstiqamət illüstrasiyaları -------------------------- */
function destCard(label, tone, motif) {
  const w = 640; const h = 400;
  const base = tone || NAVY;
  const motifs = {
    city: '<g fill="#ffffff" opacity="0.18"><rect x="70" y="200" width="70" height="140" rx="6"/><rect x="150" y="160" width="60" height="180" rx="6"/><rect x="220" y="215" width="80" height="125" rx="6"/><rect x="470" y="185" width="70" height="155" rx="6"/></g><path d="M300 130 l40 30 v60 l-20 26 h-40 l-20 -26 v-60 z" fill="#ffffff" opacity="0.25"/>',
    mountain: '<path d="M40 340 L200 175 L320 300 L420 210 L600 340 Z" fill="#ffffff" opacity="0.2"/><circle cx="510" cy="120" r="34" fill="' + GOLD + '" opacity="0.8"/>',
    forest: '<g fill="#ffffff" opacity="0.2"><path d="M120 340 l40 -80 l40 80 z"/><path d="M200 340 l46 -95 l46 95 z"/><path d="M300 340 l50 -105 l50 105 z"/><path d="M410 340 l42 -88 l42 88 z"/></g>',
    fortress: '<g fill="#ffffff" opacity="0.22"><rect x="180" y="190" width="280" height="118" rx="6"/><rect x="200" y="160" width="36" height="40"/><rect x="260" y="160" width="36" height="40"/><rect x="320" y="160" width="36" height="40"/><rect x="380" y="160" width="36" height="40"/></g>',
    bridge: '<g fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="10"><path d="M80 340 Q320 220 560 340"/><path d="M140 340 v-46M240 340 v-70M320 340 v-78M400 340 v-70M500 340 v-46"/></g>',
    lake: '<ellipse cx="320" cy="350" rx="250" ry="46" fill="#ffffff" opacity="0.2"/><path d="M40 300 L200 190 L340 300 L470 200 L600 300 Z" fill="#ffffff" opacity="0.16"/>',
    river: '<path d="M0 250 Q160 210 320 260 T640 250 L640 400 L0 400 Z" fill="#ffffff" opacity="0.16"/><path d="M60 330 Q200 290 340 330 T620 330" stroke="#ffffff" stroke-opacity="0.3" stroke-width="8" fill="none"/>'
  };
  return [
    header(w, h),
    '<defs><linearGradient id="d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + base + '"/><stop offset="1" stop-color="#00243f"/></linearGradient></defs>',
    '<rect width="' + w + '" height="' + h + '" rx="14" fill="url(#d)"/>',
    motifs[motif] || motifs.city,
    '<rect x="28" y="28" width="120" height="34" rx="17" fill="' + GOLD + '"/>',
    '<text x="88" y="51" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="700" fill="#00243f">ADY</text>',
    '<text x="32" y="368" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="700" fill="#ffffff">' + label + '</text>',
    '</svg>'
  ].join('');
}

write('dest-tbilisi.svg', destCard('Bakı — Tbilisi', '#0a4f86', 'city'));
write('dest-qebele.svg', destCard('Bakı — Qəbələ', '#0b5f7a', 'mountain'));
write('dest-agstafa.svg', destCard('Bakı — Ağstafa', '#12527f', 'forest'));
write('dest-gence.svg', destCard('Bakı — Gəncə', '#0d5aa0', 'fortress'));
write('dest-qazax.svg', destCard('Bakı — Qazax', '#0a4a74', 'bridge'));
write('dest-tovuz.svg', destCard('Bakı — Tovuz', '#0e5670', 'lake'));
write('dest-yevlax.svg', destCard('Bakı — Yevlax', '#0b4f8a', 'river'));

/* ---------------- Xidmət kartları ------------------------------------ */
function serviceCard(kind) {
  const w = 380; const h = 240;
  const art = {
    popular: '<g fill="none" stroke="' + NAVY + '" stroke-width="7" stroke-linecap="round"><path d="M40 190 L340 60"/><circle cx="40" cy="190" r="9" fill="' + GOLD + '" stroke="none"/><circle cx="340" cy="60" r="9" fill="' + GOLD + '" stroke="none"/></g><path d="M180 120 l-26 -18 l0 36 z" fill="' + NAVY + '"/>',
    children: '<rect x="120" y="70" width="140" height="110" rx="16" fill="none" stroke="' + NAVY + '" stroke-width="7"/><path d="M120 120 h140" stroke="' + NAVY + '" stroke-width="7"/><circle cx="155" cy="150" r="12" fill="none" stroke="' + GOLD + '" stroke-width="6"/><circle cx="225" cy="150" r="12" fill="none" stroke="' + GOLD + '" stroke-width="6"/>',
    balance: '<rect x="110" y="70" width="160" height="104" rx="12" fill="none" stroke="' + NAVY + '" stroke-width="7"/><rect x="110" y="98" width="160" height="22" fill="' + NAVY + '" opacity="0.25"/><rect x="214" y="130" width="56" height="26" rx="6" fill="' + GOLD + '"/>',
    luggage: '<rect x="130" y="86" width="120" height="96" rx="14" fill="none" stroke="' + NAVY + '" stroke-width="7"/><path d="M160 86 v-18 h60 v18" fill="none" stroke="' + NAVY + '" stroke-width="7"/><path d="M130 130 h120" stroke="' + GOLD + '" stroke-width="7"/>',
    pets: '<circle cx="190" cy="130" r="42" fill="none" stroke="' + NAVY + '" stroke-width="7"/><circle cx="152" cy="84" r="14" fill="' + GOLD + '"/><circle cx="228" cy="84" r="14" fill="' + GOLD + '"/><circle cx="140" cy="140" r="12" fill="none" stroke="' + NAVY + '" stroke-width="6"/><circle cx="240" cy="140" r="12" fill="none" stroke="' + NAVY + '" stroke-width="6"/>'
  };
  return [
    header(w, h),
    '<rect width="' + w + '" height="' + h + '" rx="14" fill="' + LIGHT + '"/>',
    art[kind] || art.popular,
    '</svg>'
  ].join('');
}

write('card-popular.svg', serviceCard('popular'));
write('card-children.svg', serviceCard('children'));
write('card-balance.svg', serviceCard('balance'));
write('card-luggage.svg', serviceCard('luggage'));
write('card-pets.svg', serviceCard('pets'));

/* ---------------- Tətbiq mağazası nişanları --------------------------- */
function storeBadge(store) {
  const w = 200; const h = 60;
  const label = store === 'play' ? 'Google Play' : 'App Store';
  const glyph = store === 'play'
    ? '<path d="M14 9 L36 30 L14 51 Z" fill="#f2a900"/><path d="M14 9 L44 24 L36 30 Z" fill="#4caf50"/><path d="M14 51 L44 36 L36 30 Z" fill="#e53935"/>'
    : '<path d="M30 12 c-9 0 -16 8 -16 18 c0 10 7 18 16 18 c9 0 16 -8 16 -18 c0 -10 -7 -18 -16 -18 z M30 16 c6 0 11 6 11 14 c0 8 -5 14 -11 14 c-6 0 -11 -6 -11 -14 c0 -8 5 -14 11 -14 z" fill="#fff"/><path d="M22 24 h16 M22 30 h16" stroke="#fff" stroke-width="2"/>';
  return [
    header(w, h),
    '<rect width="' + w + '" height="' + h + '" rx="10" fill="#000000"/>',
    '<g transform="translate(8,6)">' + glyph + '</g>',
    '<text x="62" y="26" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#c9c9c9">' + (store === 'play' ? 'GET IT ON' : 'Download on the') + '</text>',
    '<text x="62" y="45" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="700" fill="#ffffff">' + label + '</text>',
    '</svg>'
  ].join('');
}

write('google-play.svg', storeBadge('play'));
write('app-store.svg', storeBadge('apple'));

/* ---------------- Sosial şəbəkə ikonkaları ---------------------------- */
function social(platform) {
  const s = 40; const c = '#ffffff'; const bg = NAVY;
  const f = {
    facebook: '<path d="M23 33 v-9 h3 l1 -4 h-4 v-2.5 c0 -1.1 0.4 -1.8 1.9 -1.8 H27 V12.4 C26.4 12.3 25.2 12.2 24 12.2 c-2.7 0 -4.6 1.7 -4.6 4.7 V20 h-3 v4 h3 v9 z" fill="' + c + '"/>',
    instagram: '<rect x="11" y="11" width="18" height="18" rx="5" fill="none" stroke="' + c + '" stroke-width="2"/><circle cx="20" cy="20" r="4.6" fill="none" stroke="' + c + '" stroke-width="2"/><circle cx="25.2" cy="14.8" r="1.4" fill="' + c + '"/>',
    youtube: '<rect x="9" y="13" width="22" height="14" rx="4" fill="' + c + '"/><path d="M18 17 l6 3 l-6 3 z" fill="' + bg + '"/>',
    x: '<path d="M12 12 h4 l5 6 l5 -6 h3 l-6.6 8 l6.8 8 h-4 l-5.3 -6.4 L14 28 h-3 l7 -8.4 z" fill="' + c + '"/>',
    linkedin: '<rect x="11" y="17" width="3.4" height="12" fill="' + c + '"/><circle cx="12.7" cy="13.4" r="2" fill="' + c + '"/><path d="M18 29 v-12 h3.2 v1.7 c0.7 -1.1 1.9 -2 3.6 -2 c2.6 0 4.2 1.7 4.2 5 V29 h-3.4 v-6 c0 -1.7 -0.7 -2.6 -2 -2.6 c-1.4 0 -2.2 1 -2.2 2.6 V29 z" fill="' + c + '"/>',
    tiktok: '<path d="M22 11 v11.5 c0 2.2 -1.8 4 -4 4 c-2.2 0 -4 -1.8 -4 -4 c0 -2.2 1.8 -4 4 -4 c0.4 0 0.8 0.1 1.2 0.2 V15 c-0.4 -0.1 -0.8 -0.1 -1.2 -0.1 c-4 0 -7.2 3.2 -7.2 7.2 c0 4 3.2 7.2 7.2 7.2 c4 0 7.2 -3.2 7.2 -7.2 V15.8 c1.3 1 2.9 1.6 4.6 1.7 v-3.4 c-2.6 -0.2 -4.6 -2.3 -4.8 -5.1 z" fill="' + c + '"/>',
    telegram: '<path d="M31 11.5 L9.5 20 c-1.2 0.5 -1.2 1.2 -0.2 1.5 l5.5 1.7 l2.1 6.5 c0.3 0.8 0.5 1 1.2 1 c0.6 0 0.9 -0.3 1.3 -0.6 l2.6 -2.5 l5.4 4 c1 0.6 1.7 0.3 2 -0.9 l3.6 -17 c0.3 -1.5 -0.6 -2.2 -1.9 -1.7 z M16 23 l11 -7 l-8.5 8 l-0.4 4 z" fill="' + c + '"/>',
    whatsapp: '<path d="M20 10.5 c-5.2 0 -9.5 4.2 -9.5 9.5 c0 1.8 0.5 3.4 1.4 4.9 L10.5 30 l5.3 -1.4 c1.4 0.7 3 1.1 4.7 1.1 c5.2 0 9.5 -4.2 9.5 -9.5 c0 -5.3 -4.3 -9.7 -10 -9.7 z M15 16.5 c0.3 -0.8 0.6 -0.8 1 -0.8 h0.7 c0.2 0 0.5 0.1 0.7 0.6 l0.8 2 c0.1 0.3 0.1 0.5 0 0.7 l-0.5 0.7 c-0.2 0.2 -0.3 0.4 -0.1 0.7 c0.7 1.2 1.7 2.1 2.9 2.7 c0.3 0.1 0.5 0.1 0.7 -0.1 l0.7 -0.8 c0.2 -0.2 0.4 -0.3 0.7 -0.1 l1.9 1 c0.5 0.2 0.5 0.5 0.4 0.9 c-0.2 0.9 -1.2 1.6 -2.2 1.6 c-2.2 0 -5 -1.4 -6.9 -3.6 c-1.4 -1.6 -2 -3.4 -2 -4.7 c0 -0.8 0.3 -1.6 0.9 -2.2 z" fill="' + c + '"/>'
  };
  return [
    header(s, s),
    '<circle cx="20" cy="20" r="20" fill="' + bg + '"/>',
    f[platform] || f.facebook,
    '</svg>'
  ].join('');
}

['facebook', 'instagram', 'youtube', 'x', 'linkedin', 'tiktok', 'telegram', 'whatsapp'].forEach((p) => {
  write('social-' + p + '.svg', social(p));
});

/* ---------------- Bölmə banneri --------------------------------------- */
write('page-banner.svg', (function () {
  const w = 1440; const h = 220;
  return [
    header(w, h),
    '<defs><linearGradient id="pb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + NAVY_DARK + '"/><stop offset="1" stop-color="' + NAVY + '"/></linearGradient></defs>',
    '<rect width="' + w + '" height="' + h + '" fill="url(#pb)"/>',
    '<g stroke="' + GOLD + '" stroke-opacity="0.5" stroke-width="4" fill="none"><path d="M-20 200 L1460 150"/><path d="M-20 214 L1460 164"/></g>',
    '<circle cx="1290" cy="60" r="34" fill="' + GOLD + '" opacity="0.6"/>',
    '</svg>'
  ].join('');
})());

const files = fs.readdirSync(OUT);
console.log('[assets] ' + files.length + ' fayl yaradıldı: ' + files.join(', '));
