function notFound(req, res, next) {
  res.status(404).render('pages/error', {
    title: '404 - Səhifə tapılmadı',
    code: 404,
    message: 'Axtardığınız səhifə tapılmadı.'
  });
}

function errorHandler(err, req, res, next) {
  console.error('[error]', err && err.stack ? err.stack : err);

  const status = err.status || 500;
  if (req.xhr || req.path.startsWith('/api/')) {
    return res.status(status).json({
      ok: false,
      error: err.code || 'server_error',
      message: err.message || 'Daxili server xətası'
    });
  }

  res.status(status).render('pages/error', {
    title: `${status} - Xəta`,
    code: status,
    message: err.userMessage || 'Gözlənilməz xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.'
  });
}

module.exports = { notFound, errorHandler };
