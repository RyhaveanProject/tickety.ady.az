const config = require('../config');
const { syncReferenceData } = require('./referenceData');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

async function fetchPage(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'az,en;q=0.8,ru;q=0.6'
      }
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text, url };
  } catch (e) {
    return { ok: false, status: 0, body: '', url, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

/* HTML-dən cədvəl sətirlərini çıxarır: qatar nömrəsi + vaxtlar + qiymət */
function parseTimetableRows(html) {
  const rows = [];
  if (!html) return rows;
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  const blocks = html.match(trRe) || [];
  blocks.forEach((tr) => {
    const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [])
      .map((c) => c.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
    if (!cells.length) return;
    const joined = cells.join(' | ');
    const numMatch = joined.match(/\b(\d{3,4})\b/);
    const times = joined.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/g) || [];
    const priceMatch = joined.match(/(\d+[.,]\d{2})\s*(?:₼|AZN|azn)/);
    if (numMatch && times.length) {
      rows.push({
        number: numMatch[1],
        times: times.slice(0, 12),
        price: priceMatch ? Number(priceMatch[1].replace(',', '.')) : 0,
        raw: joined
      });
    }
  });
  return rows;
}

/* Canlı mənbədən reyslərin oxunması. Cloudflare bloklayarsa vəziyyət qeyd olunur
   və rəsmi məlumat bazası ilə işləmə davam edir. */
async function fetchLiveTimetable() {
  const base = config.liveSourceUrl.replace(/\/$/, '');
  const targets = [
    base + '/az/hereket-cedveli',
    base + '/az/populyar-istiqametler',
    base + '/az/tarifler-ve-odenis'
  ];

  const result = { pages: [], rows: [], fares: [], status: 'success', message: '' };

  for (const url of targets) {
    const page = await fetchPage(url, 15000);
    result.pages.push({ url, status: page.status, bytes: (page.body || '').length });
    if (page.status === 200) {
      const rows = parseTimetableRows(page.body);
      result.rows = result.rows.concat(rows);
      const fareMatches = (page.body.match(/(\d+[.,]\d{2})\s*₼/g) || []).slice(0, 60);
      result.fares = result.fares.concat(fareMatches);
    } else if (page.status === 403 || page.status === 503) {
      result.status = 'blocked';
      result.message = 'Mənbə sayt təhlükəsizlik qatı ilə qorunur (HTTP ' + page.status + '). Rəsmi cədvəl bazası göstərilir.';
    } else if (!result.message) {
      result.status = result.status === 'success' ? 'partial' : result.status;
      result.message = 'Bəzi səhifələr oxuna bilmədi (HTTP ' + page.status + ').';
    }
  }

  if (result.status === 'success' && !result.rows.length) {
    result.status = 'partial';
    result.message = 'Canlı səhifələr oxundu, lakin cədvəl sətirləri aşkar edilə bilmədi.';
  }

  return result;
}

/* Tam sinxronizasiya: canlı oxuma + rəsmi məlumat bazasının tətbiqi */
async function runSync(triggeredBy) {
  const live = await fetchLiveTimetable();
  const applied = await syncReferenceData(live, triggeredBy || 'system');
  return {
    live: {
      status: live.status,
      message: live.message,
      pages: live.pages,
      rowsFound: live.rows.length,
      faresFound: live.fares.length
    },
    applied
  };
}

module.exports = { fetchPage, fetchLiveTimetable, parseTimetableRows, runSync };
