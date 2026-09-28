/* ==========================================================================
   Mövcud fayllara nəzarətli yamaqlar (server, admin, auth, model, config).
   Skript bir dəfə işlədilir və nəticə yoxlanılır.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const changed = [];
const failed = [];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function write(rel, text) { fs.writeFileSync(path.join(ROOT, rel), text, 'utf8'); }
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

/* ---------------- 1) config/index.js — idarəçi hesabı standartları ------- */
apply('src/config/index.js', [{
  name: 'admin defaults',
  from: "  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),\n  adminPassword: process.env.ADMIN_PASSWORD || '',",
  to: "  adminEmail: (process.env.ADMIN_EMAIL || 'admin@ady.az').trim().toLowerCase(),\n  adminPassword: process.env.ADMIN_PASSWORD || 'Ady2026!Admin',\n  /* İdarəçi ilk girişdən sonra şifrəni dəyişməlidir */\n  adminTempPassword: bool(process.env.ADMIN_TEMP_PASSWORD, !process.env.ADMIN_PASSWORD),"
}]);

/* ---------------- 2) models/User.js — məcburi şifrə dəyişmə sahəsi ------ */
apply('src/models/User.js', [
  {
    name: 'passwordResetForced field',
    from: "  resetCode: { type: String, default: '' },",
    to: "  passwordResetForced: { type: Boolean, default: false },\n  resetCode: { type: String, default: '' },"
  },
  {
    name: 'password check helper',
    from: "userSchema.methods.comparePassword = function (plain) {",
    to: "userSchema.methods.comparePasswordSources = function (plain) {\n  return bcrypt.compare(plain, this.password || '');\n};\n\nuserSchema.methods.comparePassword = function (plain) {"
  }
]);

/* ---------------- 3) routes/auth.js — məcburi şifrə dəyişmə + giriş ----- */
apply('src/routes/auth.js', [
  {
    name: 'login redirect for forced reset',
    from: "    req.session.userId = String(user._id);\n    req.session.locale = user.locale || locale;",
    to: "    /* İdarəçi ilk girişdə şifrəni dəyişməlidir */\n    if (user.passwordResetForced) {\n      req.session.userId = String(user._id);\n      req.session.locale = user.locale || locale;\n      user.lastLoginAt = new Date();\n      await user.save();\n      return res.json({\n        ok: true,\n        message: 'Təhlükəsizlik üçün şifrəni dəyişin',\n        user: publicUser(user),\n        redirect: '/' + locale + '/sifre-yenile?forced=1'\n      });\n    }\n\n    req.session.userId = String(user._id);\n    req.session.locale = user.locale || locale;"
  },
  {
    name: 'force reset completion',
    from: "    user.password = await User.hashPassword(b.password);\n    user.resetCode = '';\n    user.resetExpires = undefined;\n    await user.save();",
    to: "    user.password = await User.hashPassword(b.password);\n    user.resetCode = '';\n    user.resetExpires = undefined;\n    user.passwordResetForced = false;\n    await user.save();"
  }
]);

/* ---------------- 4) routes/admin.js — giriş yönləndirməsi + ilk giriş -- */
apply('src/routes/admin.js', [
  {
    name: 'login redirect uses default locale',
    from: "pages.use(requireAdmin);",
    to: "pages.use(requireAdmin);\n\n/* İdarəçi hesabı ilk dəfə yaranıbsa müvəqqəti şifrə xəbərdarlığı */\nasync function ensureEnvAdmin() {\n  try {\n    const email = String(config.adminEmail || '').trim().toLowerCase();\n    if (!email) return;\n    let user = await User.findOne({ email });\n    if (!user) {\n      if (!config.adminPassword) return;\n      user = await User.create({\n        firstName: config.adminFirstName || 'Sistem',\n        lastName: config.adminLastName || 'İdarəçi',\n        email,\n        password: await User.hashPassword(config.adminPassword),\n        role: 'admin',\n        managedFromEnv: true,\n        passwordResetForced: !!config.adminTempPassword,\n        locale: config.defaultLocale\n      });\n      console.log('[admin] hesab yaradıldı: ' + email);\n    } else if (user.role !== 'admin') {\n      user.role = 'admin';\n      await user.save();\n    }\n  } catch (e) {\n    console.warn('[admin] hesab hazırlanmadı:', e.message);\n  }\n}\n\n/* İdarəetmə panelinə giriş yoxlaması — girişsiz sorğu login səhifəsinə yönləndirilir */\nfunction adminEntry(req, res, next) {\n  if (req.currentUser && req.currentUser.role === 'admin') return next();\n  const wantsJson = req.xhr || (req.headers.accept || '').includes('application/json');\n  if (wantsJson) return res.status(403).json({ ok: false, message: 'İcazə yoxdur' });\n  return res.redirect('/' + config.defaultLocale + '/login?next=' + encodeURIComponent(req.originalUrl));\n}"
  },
  {
    name: 'dashboard entry uses adminEntry',
    from: "pages.get('/', requireAdmin, async (req, res, next) => {",
    to: "pages.get('/', adminEntry, async (req, res, next) => {"
  },
  {
    name: 'module exports include ensureEnvAdmin',
    from: "module.exports = { pages, api };",
    to: "module.exports = { pages, api, ensureEnvAdmin };"
  }
]);

/* ---------------- 5) server.js — idarəçi + məzmun başlanğıcı ----------- */
apply('server.js', [
  {
    name: 'bootstrap after db connect',
    from: "    await connectDatabase();\n  } catch (e) {\n    console.error('[start] MongoDB qoşulması alınmadı:', e.message);\n  }",
    to: "    await connectDatabase();\n    if (isConnected()) {\n      const { bootstrap } = require('./src/seed/bootstrap');\n      await bootstrap();\n    }\n  } catch (e) {\n    console.error('[start] MongoDB qoşulması alınmadı:', e.message);\n  }"
  },
  {
    name: 'socials to res.locals',
    from: "app.use(localeMiddleware);\napp.use(loadUser);",
    to: "const { SOCIALS, APPS } = require('./src/config/social');\n\napp.use(localeMiddleware);\napp.use(loadUser);\n\n/* Sosial platformalar və tətbiq keçidləri bütün görünüşlərə ötürülür */\napp.use((req, res, next) => {\n  res.locals.socials = SOCIALS;\n  res.locals.apps = APPS;\n  next();\n});"
  }
]);

console.log('[patch] dəyişdirildi: ' + (changed.join(', ') || '—'));
if (failed.length) {
  console.log('[patch] uyğun gəlməyən yamaqlar: ' + failed.join(' | '));
  process.exitCode = 1;
}
