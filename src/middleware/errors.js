function notFound(req, res) {
  if ((req.headers.accept || '').includes('application/json') || req.xhr) {
    return res.status(404).json({ ok: false, message: 'Tapılmadı' });
  }
  return res.status(404).render('pages/error', {
    title: 'Səhifə tapılmadı',
    code: 404,
    message: 'Axtardığınız səhifə mövcud deyil və ya köçürülüb.'
  });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (process.env.NODE_ENV !== 'production') console.error('[error]', err);
  if ((req.headers.accept || '').includes('application/json') || req.xhr) {
    return res.status(status).json({ ok: false, message: err.message || 'Server xətası' });
  }
  return res.status(status).render('pages/error', {
    title: 'Xəta',
    code: status,
    message: err.message || 'Gözlənilməz xəta baş verdi.'
  });
}

module.exports = { notFound, errorHandler };
