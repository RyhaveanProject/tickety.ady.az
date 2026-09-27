const express = require('express');
const { Page, Faq, ContactMessage, Subscriber, Setting } = require('../models/index');

const router = express.Router();

function flatten(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ==================== CMS səhifələri ==================== */
router.get('/sehife/:slug', async (req, res, next) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug, active: true }).lean();
    if (!page) return next();
    const siblings = await Page.find({ group: page.group, active: true, slug: { $ne: page.slug } }).limit(6).lean();
    res.render('pages/cms-page', { title: page.title, page, siblings });
  } catch (e) {
    next(e);
  }
});

/* ==================== Tariflər və ödəniş ==================== */
router.get('/tarifler-ve-odenis', async (req, res, next) => {
  try {
    const pages = await Page.find({ group: 'tariffs', active: true }).sort({ order: 1 }).lean();
    res.render('pages/tariff', { title: 'Tariflər və ödəniş', pages });
  } catch (e) {
    next(e);
  }
});

router.get('/tarifler-ve-odenis/:slug', async (req, res, next) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug, active: true }).lean();
    if (!page) return next();
    const pages = await Page.find({ group: 'tariffs', active: true }).sort({ order: 1 }).lean();
    res.render('pages/cms-page', { title: page.title, page, siblings: pages });
  } catch (e) {
    next(e);
  }
});

/* ==================== Daşıma qaydaları ==================== */
router.get('/dasima-qaydalari', async (req, res, next) => {
  try {
    const pages = await Page.find({ group: 'rules', active: true }).sort({ order: 1 }).lean();
    res.render('pages/rules', { title: 'Daşıma qaydaları', pages });
  } catch (e) {
    next(e);
  }
});

router.get('/dasima-qaydalari/:slug', async (req, res, next) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug, active: true }).lean();
    if (!page) return next();
    const pages = await Page.find({ group: 'rules', active: true }).sort({ order: 1 }).lean();
    res.render('pages/cms-page', { title: page.title, page, siblings: pages });
  } catch (e) {
    next(e);
  }
});

/* ==================== Kömək / FAQ ==================== */
router.get('/komek', async (req, res, next) => {
  try {
    const faqs = await Faq.find({ active: true }).sort({ order: 1 }).lean();
    const pages = await Page.find({ group: 'rules', active: true }).sort({ order: 1 }).lean();
    res.render('pages/help', { title: 'Kömək', faqs, pages });
  } catch (e) {
    next(e);
  }
});

/* ==================== Əlaqə ==================== */
router.get('/elaqe', async (req, res, next) => {
  try {
    res.render('pages/contact', {
      title: 'Əlaqə',
      sent: req.query.sent === '1'
    });
  } catch (e) {
    next(e);
  }
});

router.post('/api/contact', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name || !b.email || !b.message) {
      return res.status(400).json({ ok: false, message: 'Ad, e-poçt və müraciət mətni vacibdir' });
    }
    await ContactMessage.create({
      name: b.name,
      email: b.email,
      phone: b.phone || '',
      subject: b.subject || '',
      message: b.message
    });
    res.json({ ok: true, message: 'Müraciətiniz qeydə alındı' });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Müraciət göndərilə bilmədi' });
  }
});

/* ==================== Abunə ==================== */
router.post('/api/subscribe', async (req, res) => {
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ ok: false, message: 'E-poçt ünvanı yanlışdır' });
    }
    await Subscriber.updateOne({ email }, { $set: { email } }, { upsert: true });
    res.json({ ok: true, message: 'Abunəliyiniz qeydə alındı' });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'Abunə alınmadı' });
  }
});

/* ==================== Haqqımızda ==================== */
router.get('/haqqimizda', async (req, res, next) => {
  try {
    let page = await Page.findOne({ slug: 'haqqimizda', active: true }).lean();
    if (!page) {
      page = await Page.findOne({ group: 'about', active: true }).lean();
    }
    if (!page) {
      page = {
        title: 'Haqqımızda',
        excerpt: 'Azərbaycan Dəmir Yolları QSC',
        content: '<p>Azərbaycan Dəmir Yolları QSC ölkənin əsas dəmir yolu daşıyıcısıdır.</p>'
      };
    }
    res.render('pages/cms-page', { title: page.title, page, siblings: [] });
  } catch (e) {
    next(e);
  }
});

/* ==================== Şərtlər ==================== */
router.get('/istifade-sertleri', async (req, res, next) => {
  try {
    let page = await Page.findOne({ slug: 'istifade-sertleri', active: true }).lean();
    if (!page) return next();
    res.render('pages/cms-page', { title: page.title, page, siblings: [] });
  } catch (e) {
    next(e);
  }
});

/* ==================== Dinamik səhifə (ən sonda) ==================== */
router.get('/:slug', async (req, res, next) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug, active: true }).lean();
    if (!page) return next();
    const siblings = await Page.find({ group: page.group, active: true, slug: { $ne: page.slug } }).limit(6).lean();
    res.render('pages/cms-page', { title: page.title, page, siblings });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
