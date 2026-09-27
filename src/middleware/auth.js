const User = require('../models/User');

/** İstifadəçini hər sorğuda yükləyir (session-dakı id ilə) */
async function loadUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.isAdmin = false;
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).lean();
      if (user) {
        req.user = user;
        res.locals.currentUser = user;
        res.locals.isAdmin = user.role === 'admin';
      } else {
        req.session.userId = null;
      }
    }
  } catch (e) {
    console.error('[auth] loadUser xəta:', e.message);
  }
  next();
}

/** Giriş tələb edən səhifələr */
function requireAuth(req, res, next) {
  if (req.user) return next();
  if (req.xhr || req.path.startsWith('/api/')) {
    return res.status(401).json({ ok: false, error: 'auth_required' });
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect(`/${req.locale || 'az'}/login?next=${encodeURIComponent(req.originalUrl)}`);
}

/** Yalnız admin */
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).render('pages/error', {
    title: '403',
    code: 403,
    message: 'Bu səhifəyə giriş icazəniz yoxdur.'
  });
}

/** Guest (giriş etməmiş) */
function requireGuest(req, res, next) {
  if (req.user) return res.redirect(`/${req.locale || 'az'}`);
  next();
}

module.exports = { loadUser, requireAuth, requireAdmin, requireGuest };
