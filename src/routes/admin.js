const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Train = require('../models/Train');
const Station = require('../models/Station');
const User = require('../models/User');
const { requireAdmin } = require('../middleware/auth');
const dayjs = require('dayjs');

/* ==================== Admin paneli ==================== */
router.get('/:lang(az|en|ru)/admin', requireAdmin, async (req, res, next) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const [users, orders, tickets, trains, stations] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Ticket.countDocuments(),
      Train.countDocuments(),
      Station.countDocuments()
    ]);

    const revenueAgg = await Order.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
    ]);
    const revenue = revenueAgg.length ? revenueAgg[0].total : 0;

    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(20).lean();
    const todayTrips = await (require('../models/Trip')).countDocuments({ date: today });

    res.render('pages/admin/dashboard', {
      title: 'İdarəetmə paneli | ADY',
      bodyClass: 'page-admin',
      stats: { users, orders, tickets, trains, stations, revenue, todayTrips },
      recentOrders
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:lang(az|en|ru)/admin/sifarisler', requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = 25;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) {
      filter.$or = [
        { orderNo: { $regex: req.query.q, $options: 'i' } },
        { trainNumber: { $regex: req.query.q, $options: 'i' } }
      ];
    }
    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();

    res.render('pages/admin/orders', {
      title: 'Sifarişlər | İdarəetmə paneli',
      bodyClass: 'page-admin',
      orders,
      page,
      pages: Math.max(1, Math.ceil(total / perPage)),
      total,
      status: req.query.status || '',
      q: req.query.q || ''
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:lang(az|en|ru)/admin/istifadeciler', requireAdmin, async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(100).lean();
    res.render('pages/admin/users', {
      title: 'İstifadəçilər | İdarəetmə paneli',
      bodyClass: 'page-admin',
      users
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:lang(az|en|ru)/admin/qatarlar', requireAdmin, async (req, res, next) => {
  try {
    const trains = await Train.find().sort({ number: 1 }).lean();
    const stations = await Station.find().sort({ order: 1 }).lean();
    res.render('pages/admin/trains', {
      title: 'Qatarlar | İdarəetmə paneli',
      bodyClass: 'page-admin',
      trains,
      stations
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Admin API ==================== */
router.get('/api/admin/stats', requireAdmin, async (req, res, next) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const Trip = require('../models/Trip');
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      const total = await Order.countDocuments({ date: d, status: 'paid' });
      last7.push({ date: d, orders: total });
    }
    res.json({
      ok: true,
      today,
      users: await User.countDocuments(),
      orders: await Order.countDocuments(),
      tickets: await Ticket.countDocuments(),
      trips: await Trip.countDocuments({ date: today }),
      last7
    });
  } catch (e) {
    next(e);
  }
});

router.post('/api/admin/orders/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: 'not_found' });
    const { status } = req.body;
    if (!['pending', 'paid', 'cancelled', 'refunded'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'invalid_status' });
    }
    order.status = status;
    await order.save();
    res.json({ ok: true, order });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
