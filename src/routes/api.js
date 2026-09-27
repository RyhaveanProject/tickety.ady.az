const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/** API sağlamlıq yoxlanışı (Render health check üçün alternativ) */
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
    version: require('../../package.json').version
  });
});

/** Sistem məlumatı */
router.get('/info', (req, res) => {
  const config = require('../config');
  res.json({
    ok: true,
    site: config.site,
    locales: config.locales,
    rules: config.rules,
    paymentMode: config.paymentMode,
    integration: {
      // Render free servisində xarici real ödəniş şlüzü qoşulmadan demo rejim işləyir
      paymentGateway: 'demo-simulator',
      note: 'Real kart emalı üçün paymentGateway adapterini (məs. AzeriCard / Kapital Bank) qoşun.'
    }
  });
});

module.exports = router;
