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

/* ==================== Saxlanılmış kartlar ==================== */
router.get('/api/account/cards', requireAuth, async (req, res) => {
  try {
    const cards = await paymentService.getUserSavedCards(req.currentUser._id);
    res.json({ ok: true, cards });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Kartlar oxunmadı' });
  }
});

router.post('/api/account/cards/:cardId/delete', requireAuth, async (req, res) => {
  try {
    await paymentService.deactivateSavedCard(req.currentUser._id, req.params.cardId);
    res.json({ ok: true, message: 'Kart silindi' });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, message: e.message || 'Kart silinmədi' });
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
    res.json({ ok: true, activeTickets: active, totalTickets: total, orders });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Məlumat oxunmadı' });
  }
});

module.exports = router;
