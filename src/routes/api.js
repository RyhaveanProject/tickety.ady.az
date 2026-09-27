const express = require('express');
const { isConnected } = require('../config/db');
const config = require('../config');

const router = express.Router();
const pkg = require('../../package.json');

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    status: 'ok',
    db: isConnected() ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
    version: pkg.version,
    time: new Date().toISOString()
  });
});

router.get('/info', (req, res) => {
  res.json({
    ok: true,
    site: config.site.name,
    fullName: config.site.fullName,
    locales: config.locales,
    defaultLocale: config.defaultLocale,
    rules: config.rules,
    liveSource: config.liveSourceUrl,
    liveSyncEnabled: config.liveSyncEnabled
  });
});

module.exports = router;
