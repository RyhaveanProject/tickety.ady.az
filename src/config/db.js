const mongoose = require('mongoose');
const config = require('./index');

let memoryServer = null;
let connected = false;

async function connectDatabase() {
  if (connected || mongoose.connection.readyState === 1) {
    connected = true;
    return mongoose.connection;
  }

  mongoose.set('strictQuery', true);

  let uri = config.mongoUri;

  if (config.useMemoryDb) {
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri('ady_ticket');
      console.log('[db] in-memory MongoDB işə salındı');
    } catch (e) {
      console.warn('[db] in-memory MongoDB əlçatan deyil:', e.message);
    }
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 12000,
    maxPoolSize: 10
  });

  connected = true;
  mongoose.connection.on('disconnected', () => { connected = false; });
  mongoose.connection.on('connected', () => { connected = true; });
  console.log('[db] MongoDB qoşuldu:', mongoose.connection.name);
  return mongoose.connection;
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDatabase, isConnected, getMemoryServer: () => memoryServer };
