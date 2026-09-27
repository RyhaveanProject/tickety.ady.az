const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const crypto = require('crypto');
const User = require('../models/User');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Payment = require('../models/Payment');
const { requireAuth } = require('../middleware/auth');
const { transactionId } = require('../services/paymentService');

/* ==================== Şəxsi kabinet ==================== */
router.get(['/:lang(az|en|ru)/kabinet', '/:lang(az|en|ru)/account'], requireAuth, async (req, res, next) => {
  try {
    const [orders, tickets] = await Promise.all([
      Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean(),
      Ticket.find({ user: req.user._id }).sort({ createdAt: -1 }).lean()
    ]);

    const activeTickets = tickets.filter((t) => t.status === 'active');
    const pastTickets = tickets.filter((t) => t.status !== 'active');
    const totalSpent = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.total, 0);

    res.render('pages/account', {
      title: 'Şəxsi kabinet | ADY',
      bodyClass: 'page-account',
      orders,
      tickets,
      activeTickets,
      pastTickets,
      totalSpent,
      stats: {
        trips: tickets.length,
        active: activeTickets.length,
        spent: totalSpent
      }
    });
  } catch (e) {
    next(e);
  }
});

router.get(['/:lang(az|en|ru)/kabinet/biletler', '/:lang(az|en|ru)/my-tickets'], requireAuth, async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    const tickets = await Ticket.find(filter).sort({ createdAt: -1 }).lean();
    res.render('pages/my-tickets', {
      title: 'Mənim biletlərim | ADY',
      bodyClass: 'page-my-tickets',
      tickets,
      status: req.query.status || ''
    });
  } catch (e) {
    next(e);
  }
});

router.get(['/:lang(az|en|ru)/kabinet/sifarisler', '/:lang(az|en|ru)/my-orders'], requireAuth, async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    res.render('pages/my-orders', {
      title: 'Sifarişlərim | ADY',
      bodyClass: 'page-my-orders',
      orders
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Bilet detalları ==================== */
router.get('/:lang(az|en|ru)/kabinet/bilet/:ticketId', requireAuth, async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, user: req.user._id }).lean();
    if (!ticket) return next();
    const order = await Order.findById(ticket.order).lean();
    res.render('pages/ticket-detail', {
      title: `Bilet ${ticket.pnr} | ADY`,
      bodyClass: 'page-ticket-detail',
      ticket,
      order
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Profil ==================== */
router.get(['/:lang(az|en|ru)/kabinet/profil', '/:lang(az|en|ru)/profile'], requireAuth, (req, res) => {
  res.render('pages/profile', {
    title: 'Profil | ADY',
    bodyClass: 'page-profile'
  });
});

/* ==================== Balans artırılması ==================== */
router.get(['/:lang(az|en|ru)/balans-artirilmasi', '/:lang(az|en|ru)/topup'], requireAuth, async (req, res, next) => {
  try {
    const payments = await Payment.find({ user: req.user._id, method: 'wallet' }).sort({ createdAt: -1 }).limit(10).lean();
    res.render('pages/topup', {
      title: 'Balansın artırılması | ADY',
      bodyClass: 'page-topup',
      payments
    });
  } catch (e) {
    next(e);
  }
});

router.post('/api/balance/topup', requireAuth, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 1 || amount > 1000) {
      return res.status(400).json({ ok: false, error: 'invalid_amount', message: 'Məbləğ 1–1000 AZN aralığında olmalıdır.' });
    }

    const user = await User.findById(req.user._id);
    user.balance = Number(((user.balance || 0) + amount).toFixed(2));
    if (req.body.cardNumber) {
      user.cardNumber = String(req.body.cardNumber).replace(/\D/g, '').slice(-4);
    }
    await user.save();

    await Payment.create({
      transactionId: transactionId(),
      order: new mongoose.Types.ObjectId(),
      user: user._id,
      amount,
      method: 'wallet',
      status: 'success',
      cardMask: req.body.cardNumber ? '**** **** **** ' + String(req.body.cardNumber).replace(/\D/g, '').slice(-4) : ''
    });

    res.json({ ok: true, balance: user.balance, message: `Balans ${amount.toFixed(2)} AZN artırıldı.` });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
