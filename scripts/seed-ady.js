/* ADY məzmununu və idarəçi hesabını bazaya yazan birdəfəlik skript.
   İstifadə: node scripts/seed-ady.js   (server.js bunu avtomatik də çağırır) */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDatabase } = require('../src/config/db');
const { bootstrap, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } = require('../src/seed/bootstrap');
const config = require('../src/config');

(async () => {
  await connectDatabase();
  await bootstrap();
  console.log('[seed-ady] tamamlandı. İdarəçi: ' + (config.adminEmail || DEFAULT_ADMIN_EMAIL)
    + (config.adminPassword ? ' (şifrə Render Environment-dən)' : ' / ' + DEFAULT_ADMIN_PASSWORD));
  await mongoose.connection.close();
  process.exit(0);
})().catch((e) => { console.error('[seed-ady] xəta:', e.message); process.exit(1); });
