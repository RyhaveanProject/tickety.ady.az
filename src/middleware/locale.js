const { dict, defaultLocale } = require('../config/i18n');

/**
 * Dil (locale) middleware-i.
 * Dil: ?lang=xx -> cookie -> istifadəçi -> default (az)
 */
function localeMiddleware(req, res, next) {
  let lang = req.query.lang;

  if (!lang && req.cookies && req.cookies.locale) lang = req.cookies.locale;
  if (!lang && req.session && req.session.userLocale) lang = req.session.userLocale;

  const available = Object.keys(dict);
  if (!lang || !available.includes(lang)) lang = req.user && req.user.locale ? req.user.locale : defaultLocale;

  req.locale = lang;
  res.locals.locale = lang;
  res.locals.lang = lang;

  if (req.query.lang && available.includes(req.query.lang)) {
    res.cookie('locale', lang, { maxAge: 365 * 24 * 3600 * 1000, httpOnly: false });
    if (req.session) req.session.userLocale = lang;
  }

  res.locals.t = (key, fallback) => {
    const table = dict[lang] || dict[defaultLocale];
    if (table[key] !== undefined) return table[key];
    if (dict[defaultLocale][key] !== undefined) return dict[defaultLocale][key];
    return fallback !== undefined ? fallback : key;
  };

  res.locals.localeNames = { az: 'AZ', en: 'EN', ru: 'RU' };
  next();
}

module.exports = localeMiddleware;
