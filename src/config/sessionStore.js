const session = require('express-session');

/**
 * LazyStore — MongoDB bağlantısı hazır olana qədər gözləyən session anbarı.
 * Beləliklə express-session yaradılarkən DB hələ qoşulmamış olsa da,
 * ilk sorğuda real MongoStore istifadə olunur.
 */
class LazyStore extends session.Store {
  constructor() {
    super();
    this.real = null;
  }

  setStore(store) {
    this.real = store;
  }

  get(sid, cb) {
    if (!this.real) return cb(null, null);
    return this.real.get(sid, cb);
  }

  set(sid, sess, cb) {
    if (!this.real) return cb && cb(null);
    return this.real.set(sid, sess, cb);
  }

  destroy(sid, cb) {
    if (!this.real) return cb && cb(null);
    return this.real.destroy(sid, cb);
  }

  touch(sid, sess, cb) {
    if (!this.real) return cb && cb(null);
    if (typeof this.real.touch === 'function') return this.real.touch(sid, sess, cb);
    return cb && cb(null);
  }

  length(cb) {
    if (!this.real) return cb(null, 0);
    return this.real.length(cb);
  }

  clear(cb) {
    if (!this.real) return cb && cb(null);
    return this.real.clear(cb);
  }

  all(cb) {
    if (!this.real) return cb(null, []);
    return this.real.all(cb);
  }
}

const lazyStore = new LazyStore();

/** MongoDB qoşulduqdan sonra çağırılır */
function attachMongoStore(mongooseInstance) {
  const MongoStore = require('connect-mongo');
  const store = MongoStore.create({
    clientPromise: Promise.resolve(mongooseInstance.connection.getClient()),
    collectionName: 'sessions',
    ttl: 30 * 24 * 3600,
    autoRemove: 'native'
  });
  lazyStore.setStore(store);
  return store;
}

module.exports = { lazyStore, attachMongoStore };
