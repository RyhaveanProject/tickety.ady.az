const express = require('express');
const router = express.Router();
const { Page, ContactMessage, Subscriber, Faq } = require('../models/Content');

/* ==================== Statik/mətn səhifələri (CMS) ==================== */
router.get('/:lang(az|en|ru)/sehife/:slug', async (req, res, next) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug, isActive: true }).lean();
    if (!page) return next();
    res.render('pages/content', {
      title: `${page.title} | ADY`,
      bodyClass: 'page-content',
      page
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Tariflər və ödəniş ==================== */
router.get(['/:lang(az|en|ru)/tarifler-ve-odenis', '/:lang(az|en|ru)/tariffs'], async (req, res, next) => {
  try {
    const items = await Page.find({ category: 'tariffs', isActive: true }).sort({ order: 1 }).lean();
    res.render('pages/tariffs', {
      title: 'Tariflər və ödəniş | ADY',
      bodyClass: 'page-tariffs',
      items
    });
  } catch (e) {
    next(e);
  }
});

router.get(
  [
    '/:lang(az|en|ru)/tarifler-ve-odenis/:slug',
    '/:lang(az|en|ru)/tariffs/:slug'
  ],
  async (req, res, next) => {
    try {
      const page = await Page.findOne({ slug: req.params.slug, isActive: true }).lean();
      if (!page) return next();
      res.render('pages/content', {
        title: `${page.title} | ADY`,
        bodyClass: 'page-content',
        page
      });
    } catch (e) {
      next(e);
    }
  }
);

/* ==================== Daşıma qaydaları ==================== */
router.get(['/:lang(az|en|ru)/dasima-qaydalari', '/:lang(az|en|ru)/rules'], async (req, res, next) => {
  try {
    const items = await Page.find({ category: 'rules', isActive: true }).sort({ order: 1 }).lean();
    res.render('pages/rules', {
      title: 'Daşıma qaydaları | ADY',
      bodyClass: 'page-rules',
      items
    });
  } catch (e) {
    next(e);
  }
});

router.get(
  [
    '/:lang(az|en|ru)/dasima-qaydalari/:slug',
    '/:lang(az|en|ru)/rules/:slug'
  ],
  async (req, res, next) => {
    try {
      const page = await Page.findOne({ slug: req.params.slug, isActive: true }).lean();
      if (!page) return next();
      res.render('pages/content', {
        title: `${page.title} | ADY`,
        bodyClass: 'page-content',
        page
      });
    } catch (e) {
      next(e);
    }
  }
);

/* ==================== Kömək / FAQ ==================== */
router.get(['/:lang(az|en|ru)/komek', '/:lang(az|en|ru)/help', '/:lang(az|en|ru)/faq'], async (req, res, next) => {
  try {
    const faqs = await Faq.find({ isActive: true }).sort({ order: 1 }).lean();
    res.render('pages/help', {
      title: 'Kömək və tez-tez verilən suallar | ADY',
      bodyClass: 'page-help',
      faqs
    });
  } catch (e) {
    next(e);
  }
});

/* ==================== Əlaqə ==================== */
router.get(['/:lang(az|en|ru)/elaqe', '/:lang(az|en|ru)/contact'], (req, res) => {
  res.render('pages/contact', {
    title: 'Əlaqə | ADY',
    bodyClass: 'page-contact',
    sent: req.query.sent === '1',
    error: null
  });
});

router.post('/api/contact', async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.redirect(`/${req.locale || 'az'}/elaqe?error=1`);
    }
    await ContactMessage.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: phone || '',
      subject: subject || '',
      message: String(message).trim(),
      ip: req.ip
    });
    res.redirect(`/${req.locale || 'az'}/elaqe?sent=1`);
  } catch (e) {
    next(e);
  }
});

router.post('/api/subscribe', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'invalid_email', message: 'E-poçt düzgün deyil.' });
    }
    await Subscriber.updateOne(
      { email },
      { email, locale: req.locale || 'az' },
      { upsert: true }
    );
    res.json({ ok: true, message: 'Abunəliyiniz uğurla qeydə alındı' });
  } catch (e) {
    next(e);
  }
});

/* ==================== Rəhbərlik / Haqqımızda ==================== */
router.get(['/:lang(az|en|ru)/haqqimizda', '/:lang(az|en|ru)/about'], async (req, res, next) => {
  try {
    const page = await Page.findOne({ slug: 'haqqimizda', isActive: true }).lean();
    res.render('pages/content', {
      title: 'Haqqımızda | ADY',
      bodyClass: 'page-content',
      page: page || {
        title: 'Haqqımızda',
        content:
          '<p>"Azərbaycan Dəmir Yolları" Qapalı Səhmdar Cəmiyyəti ölkənin dəmir yolu nəqliyyatını idarə edən dövlət şirkətidir.</p>'
      }
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
