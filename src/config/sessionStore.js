const EventEmitter = require('events');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const config = require('./index');

/* MongoDB hazır olmadan sessiya saxlamağa çalışmırıq.
   express-session anbarın öz metodlarını (createSession, generate, touch) tələb edir,
   ona görə session.Store sinfindən törədirik. */
function createLazyStore() {
  const store = new session.Store();
  let real = null;

  const fallback = {};
  const keep = function (fn, name) {
    return function () {
      const args = Array.prototype.slice.call(arguments);
      const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      if (!real && !fallback[name]) { if (cb) cb(null, null); return; }
      const target = real || fallback;
      if (typeof target[name] !== 'function') { if (cb) cb(null); return; }
      return target[name].apply(target, args.concat(cb ? [cb] : []));
    };
  };

  store.get = function (sid, cb) {
    if (!real) return cb(null, fallback['ady.sid'] && fallback['ady.sid'][sid] ? fallback['ady.sid'][sid] : null);
    return real.get(sid, cb);
  };
  store.set = function (sid, sess, cb) {
    if (!real) {
      fallback['ady.sid'] = fallback['ady.sid'] || {};
      fallback['ady.sid'][sid] = sess;
      return cb && cb(null);
    }
    return real.set(sid, sess, cb);
  };
  store.destroy = function (sid, cb) {
    if (!real) {
      if (fallback['ady.sid']) delete fallback['ady.sid'][sid];
      return cb && cb(null);
    }
    return real.destroy(sid, cb);
  };
  store.touch = function (sid, sess, cb) {
    if (!real) return store.set(sid, sess, cb);
    if (!real.touch) return cb && cb(null);
    return real.touch(sid, sess, cb);
  };
  store.length = function (cb) {
    if (!real) return cb && cb(null, Object.keys(fallback['ady.sid'] || {}).length);
    if (!real.length) return cb && cb(null, 0);
    return real.length(cb);
  };
  store.clear = function (cb) {
    if (!real) { fallback['ady.sid'] = {}; return cb && cb(null); }
    if (!real.clear) return cb && cb(null);
    return real.clear(cb);
  };
  store.all = function (cb) {
    if (!real) return cb && cb(null, fallback['ady.sid'] || {});
    if (!real.all) return cb && cb(null, {});
    return real.all(cb);
  };
  store.close = store.close || function () {};
  store.__setReal = function (inner) {
    real = inner;
    store.emit('connect');
  };
  store.__hasReal = function () {
    return !!real;
  };

  return store;
}

function attachMongoStore(store, app) { // eslint-disable-line no-unused-vars
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (store.__hasReal && store.__hasReal()) { clearInterval(timer); return; }

    if (mongoose.connection.readyState === 1) {
      clearInterval(timer);
      try {
        const inner = MongoStore.create({
          client: mongoose.connection.getClient(),
          collectionName: 'sessions',
          ttl: 30 * 24 * 60 * 60,
          autoRemove: 'native'
        });
        inner.on('error', (e) => console.warn('[session] anbar xətası:', e.message));
        store.__setReal(inner);
        console.log('[session] MongoStore aktivləşdirildi');
      } catch (e) {
        console.warn('[session] MongoStore yaradıla bilmədi:', e.message);
      }
    } else if (tries > 60) {
      clearInterval(timer);
    }
  }, 500);
}

function buildSessionMiddleware() {
  const store = createLazyStore();
  const mw = session({
    name: 'ady.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production' && String(config.siteUrl).startsWith('https'),
      maxAge: 30 * 24 * 60 * 60 * 1000
    }
  });
  mw.__store = store;
  return mw;
}

module.exports = { buildSessionMiddleware, attachMongoStore };
