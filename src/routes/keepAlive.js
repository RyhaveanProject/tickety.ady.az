/* Render free planında servis 15 dəqiqə sorğu almayanda yatır.
   Əsas həll: UptimeRobot (5 dəqiqədən bir /ping). Bu modul əlavə ehtiyat kimi
   saytın ictimai ünvanına 10 dəqiqədən bir özü sorğu göndərir.
   Ünvan: KEEPALIVE_URL > SITE_URL > RENDER_EXTERNAL_URL (Render avtomatik verir). */
const INTERVAL = (parseInt(process.env.KEEPALIVE_MINUTES, 10) || 10) * 60 * 1000;

function start() {
  if (String(process.env.KEEPALIVE_ENABLED || 'true').toLowerCase() === 'false') return;
  const base = (process.env.KEEPALIVE_URL || process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
  if (!base) { console.log('[keepalive] ünvan yoxdur (SITE_URL / RENDER_EXTERNAL_URL) — söndürüldü'); return; }
  const url = base + '/ping';
  const tick = async () => {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'ady-keepalive' } });
      if (!r.ok) console.warn('[keepalive]', r.status);
    } catch (e) { console.warn('[keepalive] alınmadı:', e.message); }
  };
  setInterval(tick, INTERVAL).unref();
  console.log('[keepalive] aktiv →', url, 'hər', INTERVAL / 60000, 'dəq');
}

module.exports = { start };
