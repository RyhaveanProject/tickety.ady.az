const { User } = require('../models/index');

/* MongoDB hazır olana qədər sorğunu gözlədir */
async function loadUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.isAdmin = false;
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).lean();
      if (user) {
        req.currentUser = user;
        res.locals.currentUser = user;
        res.locals.isAdmin = user.role === 'admin';
      } else {
        delete req.session.userId;
      }
    }
  } catch (e) {
    /* DB əlçatan deyilsə girişsiz davam et */
  }
  next();
}

function requireAuth(req, res, next) {
  const wantsJson = req.xhr || (req.headers.accept || '').includes('application/json');
  if (req.currentUser) return next();
  if (wantsJson) return res.status(401).json({ ok: false, message: res.locals.t('msg.loginRequired'), redirect: '/az/login' });
  const locale = res.locals.locale || 'az';
  return res.redirect('/' + locale + '/login?next=' + encodeURIComponent(req.originalUrl));
}

function requireAdmin(req, res, next) {
  const wantsJson = req.xhr || (req.headers.accept || '').includes('application/json');
  if (req.currentUser && req.currentUser.role === 'admin') return next();
  if (wantsJson) return res.status(403).json({ ok: false, message: res.locals.t('msg.noPermission') });
  const locale = res.locals.locale || 'az';
  return res.status(403).render('pages/error', {
    title: res.locals.t('msg.noPermission'),
    code: 403,
    message: 'Bu səhifəyə giriş icazəniz yoxdur.'
  });
}

function requireGuest(req, res, next) {
  if (req.currentUser) {
    const locale = res.locals.locale || 'az';
    return res.redirect('/' + locale + '/kabinet');
  }
  next();
}

module.exports = { loadUser, requireAuth, requireAdmin, requireGuest };
