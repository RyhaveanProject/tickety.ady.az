/* ==========================================================================
   Sosial platformalar və tətbiq mağazası keçidləri.
   Dəyərlər Render Environment-dən oxunur; boş olduqda gizlədilir.
   ========================================================================== */
require('dotenv').config();

function clean(url) {
  const v = String(url || '').trim();
  return /^https?:\/\//i.test(v) ? v : '';
}

const SOCIALS = [
  { key: 'facebook', name: 'Facebook', url: clean(process.env.SOCIAL_FACEBOOK) },
  { key: 'instagram', name: 'Instagram', url: clean(process.env.SOCIAL_INSTAGRAM) },
  { key: 'youtube', name: 'YouTube', url: clean(process.env.SOCIAL_YOUTUBE) },
  { key: 'x', name: 'X', url: clean(process.env.SOCIAL_X) },
  { key: 'linkedin', name: 'LinkedIn', url: clean(process.env.SOCIAL_LINKEDIN) },
  { key: 'tiktok', name: 'TikTok', url: clean(process.env.SOCIAL_TIKTOK) },
  { key: 'telegram', name: 'Telegram', url: clean(process.env.SOCIAL_TELEGRAM) },
  { key: 'whatsapp', name: 'WhatsApp', url: clean(process.env.SOCIAL_WHATSAPP) }
].filter((s) => s.url);

/* Rəsmi ADY tətbiqinin universal keçidi (rəsmi saytdakı ady.onelink.me istifadə olunur) */
const APPS = {
  play: clean(process.env.APP_GOOGLE_PLAY) || 'https://ady.onelink.me/KE2R/snvxxwtl',
  apple: clean(process.env.APP_APP_STORE) || 'https://ady.onelink.me/KE2R/snvxxwtl'
};

module.exports = { SOCIALS, APPS };
