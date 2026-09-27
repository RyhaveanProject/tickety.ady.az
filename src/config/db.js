const mongoose = require('mongoose');
const config = require('./index');

let memoryServer = null;

/**
 * MongoDB-yə qoşulur.
 * - MONGODB_URI varsa -> ona qoşulur (Atlas / lokal).
 * - Yoxdursa və USE_MEMORY_DB=true -> müvəqqəti yaddaş MongoDB-si işə salınır (demo).
 */
async function connectDB() {
  let uri = config.mongoUri;

  if (!uri) {
    if (!config.useMemoryDb) {
      throw new Error(
        'MONGODB_URI təyin edilməyib. .env faylında MONGODB_URI dəyərini qeyd edin ' +
        '(məsələn MongoDB Atlas pulsuz cluster) və ya USE_MEMORY_DB=true edin.'
      );
    }
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri('ady_ticket');
      console.log('[db] MONGODB_URI yoxdur -> müvəqqəti yaddaş MongoDB işə salındı (demo rejimi).');
      console.log('[db] Diqqət: yaddaş rejimində məlumatlar server yenidən başladıqda silinir.');
    } catch (e) {
      throw new Error(
        'MONGODB_URI təyin edilməyib və yaddaş MongoDB-si işə salına bilmədi (' + e.message + '). ' +
        'Zəhmət olmasa MONGODB_URI dəyərini qeyd edin.'
      );
    }
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 20000,
    maxPoolSize: 10
  });

  const safeUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log('[db] MongoDB qoşuldu: ' + safeUri.split('?')[0]);

  mongoose.connection.on('error', (err) => console.error('[db] Xəta:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[db] Bağlantı kəsildi.'));

  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.connection.close();
  if (memoryServer) await memoryServer.stop();
}

module.exports = { connectDB, disconnectDB, getMemoryServer: () => memoryServer };
