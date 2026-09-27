const config = require('../config');
const { translate, dicts } = require('../config/i18n');

const localeNames = config.localeNames;

function localeMiddleware(req, res, next) {
  let locale = req.query.lang || req.cookies.locale || (req.session && req.session.locale) || config.defaultLocale;
  if (config.locales.indexOf(locale) === -1) locale = config.defaultLocale;
  if (req.query.lang && config.locales.indexOf(req.query.lang) > -1) {
    res.cookie('locale', locale, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax' });
    if (req.session) req.session.locale = locale;
  }
  req.locale = locale;
  res.locals.locale = locale;
  res.locals.locales = config.locales;
  res.locals.localeNames = localeNames;
  res.locals.dict = dicts[locale] || dicts.az;
  res.locals.t = function () {
    return translate.apply(null, [locale].concat(Array.prototype.slice.call(arguments)));
  };
  res.locals.path = req.path;
  res.locals.query = req.query;
  res.locals.site = config.site;
  res.locals.rules = config.rules;
  res.locals.year = new Date().getFullYear();
  next();
}

module.exports = localeMiddleware;
