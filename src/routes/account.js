const express = require('express');
const { Order, Ticket, Payment, User } = require('../models/index');
const { requireAuth } = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const bookingService = require('../services/bookingService');
const config = require('../config');
const h = require('../utils/helpers');

const router = express.Router();

/* ==================== Kabinet ==================== */
router.get('/kabinet', requireAuth, async (req, res, next) => {
  try {
    const [orders, tickets, payments] = await Promise.all([
      Order.find({ user: req.currentUser._id }).sort({ createdAt: -1 }).limit(5).lean(),
      Ticket.find({ user: req.currentUser._id, status: 'active' }).sort({ date: 1 }).limit(5).lean(),
      Payment.find({ user: req.currentUser._id }).sort({ createdAt: -1 }).limit(5).lean()
    ]);

    res.render('pages/account', {
      title: res.locals.t('nav.profile'),
      orders,
      tickets,
      payments,
      user: req.currentUser
    });
  } catch (e) {
    next(e);
  }
});

router.get('/kabinet/biletler', requireAuth, async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ user: req.currentUser._id }).sort({ date: -1 }).lean();
    res.render('pages/my-tickets', { title: res.locals.t('nav.myTickets'), tickets });
  } catch (e) {
    next(e);
  }
});

router.get('/kabinet/sifarisler', requireAuth, async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.currentUser._id }).sort({ createdAt: -1 }).lean();
    const paymentIds = orders.map((o) => o.payment).filter(Boolean);
    const payments = await Payment.find({ _id: { $in: paymentIds } }).lean();
    const payMap = {};
    payments.forEach((p) => { payMap[String(p._id)] = p; });

    res.render('pages/orders', {
      title: res.locals.t('nav.myOrders'),
      orders,
      payMap
    });
  } catch (e) {
    next(e);
  }
});

router.get('/kabinet/profil', requireAuth, async (req, res, next) => {
  try {
    res.render('pages/profile', { title: 'Profil', user: req.currentUser });
  } catch (e) {
    next(e);
  }
});

/* ==================== Balans ==================== */
router.get('/balans-artirilmasi', requireAuth, async (req, res, next) => {
  try {
    const payments = await Payment.find({ user: req.currentUser._id, order: null }).sort({ createdAt: -1 }).limit(10).lean();
    res.render('pages/topup', { title: res.locals.t('nav.balance'), user: req.currentUser, payments });
  } catch (e) {
    next(e);
  }
});

/* Balans artırımı da kart məlumatları ilə admin təsdiqindən keçir */
router.post('/api/balance/topup', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const amount = Number(b.amount);
    if (!amount || amount < 1 || amount > 1000) {
      return res.status(400).json({ ok: false, message: 'Məbləğ 1 - 1000 ₼ aralığında olmalıdır' });
    }

    if (!h.luhnValid((b.card || {}).number)) {
      return res.status(400).json({ ok: false, message: 'Kart nömrəsi yanlışdır' });
    }
    if (!String((b.card || {}).holder || '').trim()) {
      return res.status(400).json({ ok: false, message: 'Kart sahibinin adı daxil edilməyib' });
    }
    const parts = String((b.card || {}).expiry || '').split('/');
    if (parts.length !== 2 || !h.expiryValid(parts[0], parts[1])) {
      return res.status(400).json({ ok: false, message: 'Kartın bitmə tarixi yanlışdır' });
    }
    if (!/^\d{3,4}$/.test(String((b.card || {}).cvv || '').trim())) {
      return res.status(400).json({ ok: false, message: 'CVV yanlışdır' });
    }

    const payment = await paymentService.createTopup(req.currentUser, amount, b.card);

    return res.json({
      ok: true,
      message: 'Balans artırımı təsdiqə göndərildi.',
      paymentId: String(payment._id),
      redirect: '/' + res.locals.locale + '/balans-gozleme/' + payment._id
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Əməliyyat alınmadı' });
  }
});

router.post('/api/account/toppay', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    if (!h.luhnValid((b.card || {}).number)) {
      return res.status(400).json({ ok: false, message: 'Kart nömrəsi yanlışdır' });
    }
    const payment = await paymentService.createTopup(req.currentUser, Number(b.amount) || 10, b.card);
    return res.json({ ok: true, message: 'Göndərildi', paymentId: String(payment._id), redirect: '/' + res.locals.locale + '/balans-gozleme/' + payment._id });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Alınmadı' });
  }
});

/* Balans artırımının mərhələsi -> ekran yolu */
function topupPath(locale, p) {
  if (p.status === 'awaiting_3ds' || p.status === 'code_submitted') return '/' + locale + '/balans-3d/' + p._id;
  if (p.status === 'approved' || p.status === 'declined') return '/' + locale + '/balans-natice/' + p._id;
  return '/' + locale + '/balans-gozleme/' + p._id;
}

async function loadTopup(req) {
  return Payment.findOne({ _id: req.params.paymentId, user: req.currentUser._id, order: null }).lean();
}

/* Admin kartı təsdiqləyənə qədər gözləmə ekranı */
router.get('/balans-gozleme/:paymentId', requireAuth, async (req, res, next) => {
  try {
    const p = await loadTopup(req);
    if (!p) return next();
    const target = topupPath(res.locals.locale, p);
    if (target.indexOf('/balans-gozleme/') === -1) return res.redirect(target);
    res.render('pages/topup-status', { title: res.locals.t('nav.balance'), payment: p, stage: 'waiting' });
  } catch (e) { next(e); }
});

/* 3-D Secure kodu ekranı */
router.get('/balans-3d/:paymentId', requireAuth, async (req, res, next) => {
  try {
    const p = await loadTopup(req);
    if (!p) return next();
    const target = topupPath(res.locals.locale, p);
    if (target.indexOf('/balans-3d/') === -1) return res.redirect(target);
    res.render('pages/topup-status', {
      title: res.locals.t('secure3d.title'),
      payment: p,
      stage: p.status === 'code_submitted' ? 'final' : '3ds'
    });
  } catch (e) { next(e); }
});

/* Nəticə */
router.get('/balans-natice/:paymentId', requireAuth, async (req, res, next) => {
  try {
    const p = await loadTopup(req);
    if (!p) return next();
    const user = await User.findById(req.currentUser._id).lean();
    res.render('pages/topup-status', { title: res.locals.t('nav.balance'), payment: p, stage: p.status, balance: user ? user.balance || 0 : 0 });
  } catch (e) { next(e); }
});

/* Balans artırımının vəziyyəti — ekranlar canlı sorğulayır */
router.get('/api/balance/topup-status/:paymentId', requireAuth, async (req, res) => {
  try {
    const p = await loadTopup(req);
    if (!p) return res.status(404).json({ ok: false, message: 'Əməliyyat tapılmadı' });
    const user = await User.findById(req.currentUser._id).lean();
    const stage = p.status === 'pending_admin' ? 'waiting'
      : p.status === 'awaiting_3ds' ? '3ds'
      : p.status === 'code_submitted' ? 'final' : p.status;
    res.json({
      ok: true,
      status: p.status,
      stage,
      balance: user ? (user.balance || 0) : 0,
      redirect: topupPath(res.locals.locale, p)
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Vəziyyət oxunmadı' });
  }
});

/* Sərnişin adı ilə bilet axtarışı və s. əlavə funksiyalar üçün sadə məlumat nöqtəsi */
router.get('/api/account/summary', requireAuth, async (req, res) => {
  try {
    const [active, total, orders] = await Promise.all([
      Ticket.countDocuments({ user: req.currentUser._id, status: 'active' }),
      Ticket.countDocuments({ user: req.currentUser._id }),
      Order.countDocuments({ user: req.currentUser._id })
    ]);
    const user = await User.findById(req.currentUser._id).lean();
    res.json({ ok: true, activeTickets: active, totalTickets: total, orders, balance: user ? user.balance : 0 });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Məlumat oxunmadı' });
  }
});

module.exports = router;
