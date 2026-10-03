function tf(res, key, fallback) {
  return (res.locals && typeof res.locals.t === 'function') ? res.locals.t(key) : fallback;
}

function notFound(req, res) {
  if ((req.headers.accept || '').includes('application/json') || req.xhr) {
    return res.status(404).json({ ok: false, message: tf(res, 'error.notFoundTitle', 'Səhifə tapılmadı') });
  }
  return res.status(404).render('pages/error', {
    title: tf(res, 'error.notFoundTitle', 'Səhifə tapılmadı'),
    code: 404,
    message: tf(res, 'error.notFoundMsg', 'Axtardığınız səhifə mövcud deyil və ya köçürülüb.')
  });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (process.env.NODE_ENV !== 'production') console.error('[error]', err);
  if ((req.headers.accept || '').includes('application/json') || req.xhr) {
    return res.status(status).json({ ok: false, message: err.message || tf(res, 'error.generic', 'Server xətası') });
  }
  return res.status(status).render('pages/error', {
    title: tf(res, 'error.title', 'Xəta'),
    code: status,
    message: err.message || tf(res, 'error.generic', 'Gözlənilməz xəta baş verdi.')
  });
}

module.exports = { notFound, errorHandler };
