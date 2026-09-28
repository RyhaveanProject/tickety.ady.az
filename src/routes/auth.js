const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models/index');
const { requireGuest, requireAuth } = require('../middleware/auth');
const config = require('../config');
const h = require('../utils/helpers');

const router = express.Router();

function wantsJson(req) {
  return req.xhr || (req.headers.accept || '').includes('application/json');
}

function publicUser(u) {
  return {
    id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    balance: u.balance
  };
}

/* ==================== Səhifələr ==================== */

router.get('/login', requireGuest, (req, res) => {
  res.render('pages/auth/login', { title: 'Daxil ol' });
});

router.get('/qeydiyyat', requireGuest, (req, res) => {
  res.render('pages/auth/register', { title: 'Qeydiyyat' });
});

router.get('/sifre-berpasi', requireGuest, (req, res) => {
  res.render('pages/auth/forgot', { title: 'Şifrənin bərpası' });
});

router.get('/sifre-yenile', requireGuest, (req, res) => {
  res.render('pages/auth/reset', { title: 'Yeni şifrə', token: req.query.token || '' });
});

/* Rəsmi saytdakı ünvanlarla uyğunluq */
router.get('/daxil-ol', requireGuest, (req, res) => {
  res.render('pages/auth/login', { title: 'Daxil ol' });
});

router.get('/sifreni-unutdum', requireGuest, (req, res) => {
  res.render('pages/auth/forgot', { title: 'Şifrənin bərpası' });
});

/* ==================== API ==================== */

router.post('/api/auth/register', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.firstName || !b.lastName || !b.email || !b.password) {
      return res.status(400).json({ ok: false, message: 'Bütün vacib xanaları doldurun' });
    }
    if (String(b.password).length < 6) {
      return res.status(400).json({ ok: false, message: 'Şifrə ən azı 6 simvol olmalıdır' });
    }
    if (b.passwordRepeat && b.passwordRepeat !== b.password) {
      return res.status(400).json({ ok: false, message: 'Şifrələr uyğun gəlmir' });
    }

    const email = String(b.email).trim().toLowerCase();
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ ok: false, message: 'Bu e-poçt ilə hesab artıq mövcuddur' });

    const user = await User.create({
      firstName: b.firstName,
      lastName: b.lastName,
      middleName: b.middleName || '',
      email,
      phone: h.normalizePhone(b.phone),
      passport: b.passport || '',
      password: await User.hashPassword(b.password),
      role: 'user',
      locale: res.locals.locale
    });

    req.session.userId = String(user._id);
    const locale = res.locals.locale;

    return res.json({
      ok: true,
      message: 'Qeydiyyat tamamlandı',
      user: publicUser(user),
      redirect: '/' + locale + '/kabinet'
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Qeydiyyat alınmadı' });
  }
});

router.post('/api/auth/login', async (req, res) => {
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const password = String((req.body || {}).password || '');
    const locale = res.locals.locale;

    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'E-poçt və şifrə daxil edin' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ ok: false, message: 'E-poçt və ya şifrə yanlışdır' });
    }

    /* İdarəçi ilk girişdə şifrəni dəyişməlidir */
    if (user.passwordResetForced) {
      req.session.userId = String(user._id);
      req.session.locale = user.locale || locale;
      user.lastLoginAt = new Date();
      await user.save();
      return res.json({
        ok: true,
        message: 'Təhlükəsizlik üçün şifrəni dəyişin',
        user: publicUser(user),
        redirect: '/' + locale + '/sifre-yenile?forced=1'
      });
    }

    req.session.userId = String(user._id);
    req.session.locale = user.locale || locale;
    user.lastLoginAt = new Date();
    await user.save();

    /* Rol yalnız hesabın özünə əsasən müəyyən olunur; adi giriş axını eynidir */
    const panel = user.role === 'admin' ? '/' + locale + '/admin' : '/' + locale + '/kabinet';

    return res.json({ ok: true, message: 'Xoş gəlmisiniz', user: publicUser(user), redirect: panel });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Giriş alınmadı' });
  }
});

router.post('/api/auth/logout', (req, res) => {
  const locale = res.locals.locale;
  req.session.destroy(() => {
    res.json({ ok: true, redirect: '/' + locale });
  });
});

router.post('/api/auth/forgot', async (req, res) => {
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user) return res.json({ ok: true, message: 'Bərpa kodu göndərildi' });

    const code = h.randomDigits(6);
    user.resetCode = code;
    user.resetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    return res.json({ ok: true, message: 'Bərpa kodu göndərildi', token: code });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Əməliyyat alınmadı' });
  }
});

router.post('/api/auth/reset', async (req, res) => {
  try {
    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase();
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(404).json({ ok: false, message: 'Hesab tapılmadı' });
    if (!user.resetCode || user.resetCode !== String(b.code || '').trim()) {
      return res.status(400).json({ ok: false, message: 'Kod yanlışdır' });
    }
    if (user.resetExpires && user.resetExpires.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, message: 'Kodun müddəti bitib' });
    }
    if (String(b.password || '').length < 6) {
      return res.status(400).json({ ok: false, message: 'Şifrə ən azı 6 simvol olmalıdır' });
    }

    user.password = await User.hashPassword(b.password);
    user.resetCode = '';
    user.resetExpires = undefined;
    user.passwordResetForced = false;
    await user.save();

    return res.json({ ok: true, message: 'Şifrə yeniləndi', redirect: '/' + res.locals.locale + '/login' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Əməliyyat alınmadı' });
  }
});

router.post('/api/account/profile', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const user = await User.findById(req.currentUser._id);
    if (!user) return res.status(404).json({ ok: false, message: 'İstifadəçi tapılmadı' });

    ['firstName', 'lastName', 'middleName', 'passport', 'birthDate'].forEach((f) => {
      if (b[f] !== undefined) user[f] = b[f];
    });
    if (b.phone !== undefined) user.phone = h.normalizePhone(b.phone);
    if (b.locale && config.locales.indexOf(b.locale) > -1) user.locale = b.locale;

    await user.save();
    return res.json({ ok: true, message: 'Məlumatlar yadda saxlanıldı' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Yadda saxlanılmadı' });
  }
});

router.post('/api/account/password', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const user = await User.findById(req.currentUser._id).select('+password');
    if (!user) return res.status(404).json({ ok: false, message: 'İstifadəçi tapılmadı' });
    if (!(await bcrypt.compare(String(b.current || ''), user.password))) {
      return res.status(400).json({ ok: false, message: 'Cari şifrə yanlışdır' });
    }
    if (String(b.password || '').length < 6) {
      return res.status(400).json({ ok: false, message: 'Yeni şifrə ən azı 6 simvol olmalıdır' });
    }
    user.password = await User.hashPassword(b.password);
    await user.save();
    return res.json({ ok: true, message: 'Şifrə dəyişdirildi' });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Şifrə dəyişdirilə bilmədi' });
  }
});

module.exports = router;
