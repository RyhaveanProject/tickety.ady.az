const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Order = require('../models/Order');
const { requireGuest, requireAuth } = require('../middleware/auth');
const { normalizePhone } = require('../utils/helpers');

const LANGS = ['az', 'en', 'ru'];

/* ==================== Şablon əsaslı auth səhifələri ==================== */
router.get(['/:lang(az|en|ru)/login', '/:lang(az|en|ru)/daxil-ol'], requireGuest, (req, res) => {
  res.render('pages/auth/login', {
    title: 'Daxil ol | ADY',
    bodyClass: 'page-auth',
    next: req.query.next || '',
    error: null,
    values: {}
  });
});

router.get(
  ['/:lang(az|en|ru)/register', '/:lang(az|en|ru)/qeydiyyat'],
  requireGuest,
  (req, res) => {
    res.render('pages/auth/register', {
      title: 'Qeydiyyat | ADY',
      bodyClass: 'page-auth',
      error: null,
      values: {}
    });
  }
);

router.get(['/:lang(az|en|ru)/forgot-password', '/:lang(az|en|ru)/sifre-berpa'], requireGuest, (req, res) => {
  res.render('pages/auth/forgot', {
    title: 'Şifrənin bərpası | ADY',
    bodyClass: 'page-auth',
    sent: false,
    error: null
  });
});

/* ==================== API əsaslı auth ==================== */
router.post('/api/auth/register', async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password, passwordConfirm, docNumber, docType, newsOptIn } = req.body;

    const errors = {};
    if (!firstName || firstName.trim().length < 2) errors.firstName = 'Ad düzgün daxil edilməyib.';
    if (!lastName || lastName.trim().length < 2) errors.lastName = 'Soyad düzgün daxil edilməyib.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email || '')) errors.email = 'E-poçt düzgün deyil.';
    if (String(password || '').length < 6) errors.password = 'Şifrə ən azı 6 simvol olmalıdır.';
    if (password !== passwordConfirm) errors.passwordConfirm = 'Şifrələr uyğun gəlmir.';
    if (normalizePhone(phone).length !== 13) errors.phone = 'Telefon nömrəsi düzgün deyil.';

    if (Object.keys(errors).length) {
      return res.status(400).json({ ok: false, error: 'validation', errors });
    }

    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) {
      return res.status(409).json({ ok: false, error: 'email_exists', errors: { email: 'Bu e-poçt artıq qeydiyyatdan keçib.' } });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: String(email).toLowerCase().trim(),
      phone: normalizePhone(phone),
      passwordHash,
      docType: docType || 'fin',
      docNumber: (docNumber || '').trim().toUpperCase(),
      locale: req.locale || 'az',
      newsOptIn: newsOptIn === undefined ? true : !!newsOptIn
    });

    req.session.userId = user._id.toString();
    req.session.userLocale = user.locale;

    // Aktiv sifarişləri (guest səbətində olanları) istifadəçiyə bağlamaq lazım deyil

    res.json({
      ok: true,
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      redirect: `/${req.locale || 'az'}/kabinet`
    });
  } catch (e) {
    next(e);
  }
});

router.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password, remember } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({ ok: false, error: 'invalid_credentials', message: 'E-poçt və ya şifrə yanlışdır.' });
    }
    const match = await bcrypt.compare(String(password || ''), user.passwordHash);
    if (!match) {
      return res.status(401).json({ ok: false, error: 'invalid_credentials', message: 'E-poçt və ya şifrə yanlışdır.' });
    }

    req.session.userId = user._id.toString();
    req.session.userLocale = user.locale;
    if (remember) req.session.cookie.maxAge = 30 * 24 * 3600 * 1000;

    user.lastLoginAt = new Date();
    await user.save();

    const isAdmin = user.role === 'admin';
    res.json({
      ok: true,
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
      redirect: isAdmin ? `/${req.locale || 'az'}/admin` : `/${req.locale || 'az'}/kabinet`
    });
  } catch (e) {
    next(e);
  }
});

router.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('ady.sid');
    res.json({ ok: true, redirect: `/${req.locale || 'az'}` });
  });
});

router.post('/api/auth/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase().trim() });
    // Təhlükəsizlik: istifadəçi mövcud olmasa da eyni cavab
    if (user) {
      const token = crypto.randomBytes(24).toString('hex');
      user.resetToken = token;
      user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      console.log(`[auth] Şifrə bərpa linki (demo): /${req.locale || 'az'}/sifre-berpa/${token}`);
    }
    res.json({ ok: true, message: 'Bərpa linki e-poçtunuza göndərildi (demo rejimində konsola yazılır).' });
  } catch (e) {
    next(e);
  }
});

router.get(['/:lang(az|en|ru)/sifre-berpa/:token', '/:lang(az|en|ru)/reset-password/:token'], async (req, res, next) => {
  try {
    const user = await User.findOne({
      resetToken: req.params.token,
      resetTokenExpires: { $gt: new Date() }
    });
    if (!user) {
      return res.render('pages/error', {
        title: '404',
        code: 404,
        message: 'Bərpa linki etibarsızdır və ya vaxtı keçib.'
      });
    }
    res.render('pages/auth/reset', {
      title: 'Yeni şifrə | ADY',
      bodyClass: 'page-auth',
      token: req.params.token,
      error: null
    });
  } catch (e) {
    next(e);
  }
});

router.post('/api/auth/reset-password', async (req, res, next) => {
  try {
    const { token, password, passwordConfirm } = req.body;
    if (String(password || '').length < 6) {
      return res.status(400).json({ ok: false, error: 'weak_password', message: 'Şifrə ən azı 6 simvol olmalıdır.' });
    }
    if (password !== passwordConfirm) {
      return res.status(400).json({ ok: false, error: 'mismatch', message: 'Şifrələr uyğun gəlmir.' });
    }
    const user = await User.findOne({ resetToken: token, resetTokenExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ ok: false, error: 'invalid_token', message: 'Link etibarsızdır.' });

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = '';
    user.resetTokenExpires = undefined;
    await user.save();

    req.session.userId = user._id.toString();
    res.json({ ok: true, redirect: `/${req.locale || 'az'}/kabinet` });
  } catch (e) {
    next(e);
  }
});

/* ==================== Profil yeniləmə ==================== */
router.post('/api/auth/profile', requireAuth, async (req, res, next) => {
  try {
    const { firstName, lastName, phone, docType, docNumber, newsOptIn } = req.body;
    const user = await User.findById(req.user._id);

    if (firstName) user.firstName = firstName.trim();
    if (lastName) user.lastName = lastName.trim();
    if (phone) user.phone = normalizePhone(phone);
    if (docType) user.docType = docType;
    if (docNumber !== undefined) user.docNumber = String(docNumber).trim().toUpperCase();
    if (newsOptIn !== undefined) user.newsOptIn = !!newsOptIn;

    await user.save();
    res.json({ ok: true, message: 'Məlumatlar yeniləndi.' });
  } catch (e) {
    next(e);
  }
});

router.post('/api/auth/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;
    const user = await User.findById(req.user._id);
    const match = await bcrypt.compare(String(currentPassword || ''), user.passwordHash);
    if (!match) return res.status(400).json({ ok: false, error: 'wrong_password', message: 'Cari şifrə yanlışdır.' });
    if (String(newPassword || '').length < 6) {
      return res.status(400).json({ ok: false, error: 'weak_password', message: 'Yeni şifrə ən azı 6 simvol olmalıdır.' });
    }
    if (newPassword !== newPasswordConfirm) {
      return res.status(400).json({ ok: false, error: 'mismatch', message: 'Yeni şifrələr uyğun gəlmir.' });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true, message: 'Şifrə dəyişdirildi.' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
