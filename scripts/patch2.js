/* ==========================================================================
   İkinci mərhələ yamaqları:
   1) Məzmun modelinə durationText / distanceKm sahələri
   2) server.js — məzmunun ilkin yazılışının növbəti (autoSeed-dən SONRA)
   3) config — müvəqqəti şifrə məcburiyyəti söndürülür (idarəçi girişi işlək olsun)
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const changed = [];
const failed = [];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function write(rel, t) { fs.writeFileSync(path.join(ROOT, rel), t, 'utf8'); }
function apply(rel, edits) {
  let text = read(rel);
  let ok = true;
  edits.forEach((e) => {
    if (text.indexOf(e.to) > -1 && text.indexOf(e.from) === -1) return;
    if (text.indexOf(e.from) === -1) { ok = false; failed.push(rel + ' :: ' + e.name); return; }
    text = text.replace(e.from, e.to);
  });
  if (ok) { write(rel, text); changed.push(rel); }
}

/* 1) Content.js — istiqamət sahələri */
apply('src/models/Content.js', [{
  name: 'destination extra fields',
  from: "  stationCode: { type: String, default: '' },\n  priceFrom: { type: Number, default: 0 },",
  to: "  stationCode: { type: String, default: '' },\n  priceFrom: { type: Number, default: 0 },\n  durationText: { type: String, default: '' },\n  distanceKm: { type: Number, default: 0 },"
}]);

/* 2) server.js — bootstrap autoSeed-dən sonra işləsin */
apply('server.js', [
  {
    name: 'move bootstrap after autoSeed',
    from: "    await connectDatabase();\n    if (isConnected()) {\n      const { bootstrap } = require('./src/seed/bootstrap');\n      await bootstrap();\n    }\n  } catch (e) {",
    to: "    await connectDatabase();\n  } catch (e) {"
  },
  {
    name: 'call bootstrap after autoSeed',
    from: "    } catch (e) {\n      console.warn('[start] ilkin məlumat yazıla bilmədi:', e.message);\n    }\n  }",
    to: "    } catch (e) {\n      console.warn('[start] ilkin məlumat yazıla bilmədi:', e.message);\n    }\n  }\n\n  /* ADY məzmunu və idarəçi hesabı — ilkin yazılışdan sonra tətbiq olunur */\n  if (isConnected()) {\n    try {\n      const { bootstrap } = require('./src/seed/bootstrap');\n      await bootstrap();\n    } catch (e) {\n      console.warn('[start] ADY məzmunu hazırlanmadı:', e.message);\n    }\n  }"
  }
]);

/* 3) config — məcburi şifrə dəyişmə standart olaraq bağlıdır */
apply('src/config/index.js', [{
  name: 'temp password default false',
  from: "  adminTempPassword: bool(process.env.ADMIN_TEMP_PASSWORD, !process.env.ADMIN_PASSWORD),",
  to: "  adminTempPassword: bool(process.env.ADMIN_TEMP_PASSWORD, false),"
}]);

console.log('[patch2] dəyişdirildi: ' + (changed.join(', ') || '—'));
if (failed.length) { console.log('[patch2] uyğun gəlməyən: ' + failed.join(' | ')); process.exitCode = 1; }
