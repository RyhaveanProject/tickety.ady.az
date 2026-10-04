/* public/js/payment.js — kart ödənişi formu (yalnız kart məlumatları) */
(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }

  function note(msg, kind) {
    var box = $('#payNote');
    if (!box) { if (kind === 'error') alert(msg); return; }
    box.className = 'alert alert--' + (kind || 'info');
    box.textContent = msg;
    box.classList.remove('hidden');
  }

  function digits(v) { return String(v || '').replace(/\D/g, ''); }

  function brandOf(num) {
    var n = digits(num);
    if (/^4/.test(n)) return 'VISA';
    if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'MASTERCARD';
    if (/^3[47]/.test(n)) return 'AMEX';
    if (/^(6219|9840)/.test(n)) return 'MIR';
    return '';
  }

  function luhn(num) {
    var n = digits(num);
    if (n.length < 13 || n.length > 19) return false;
    var sum = 0, dbl = false;
    for (var i = n.length - 1; i >= 0; i--) {
      var d = parseInt(n.charAt(i), 10);
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  function expiryValid(v) {
    var m = /^(\d{2})\/(\d{2})$/.exec(String(v || '').trim());
    if (!m) return false;
    var mm = parseInt(m[1], 10);
    var yy = 2000 + parseInt(m[2], 10);
    if (mm < 1 || mm > 12) return false;
    var end = new Date(yy, mm, 1).getTime();
    return end > Date.now();
  }

  function bindFormatting(form) {
    var number = $('[data-card-number]', form);
    var expiry = $('[data-card-expiry]', form);
    var cvv = $('[data-card-cvv]', form);
    var holder = form.querySelector('input[name="holder"]');

    if (number) {
      number.addEventListener('input', function () {
        var n = digits(number.value).slice(0, 19);
        number.value = n.replace(/(.{4})/g, '$1 ').trim();
        var vn = $('#visualNumber');
        if (vn) vn.textContent = (number.value || '•••• •••• •••• ••••');
        var vb = $('#visualBrand');
        if (vb && brandOf(n)) vb.textContent = brandOf(n);
      });
    }
    if (expiry) {
      expiry.addEventListener('input', function () {
        var n = digits(expiry.value).slice(0, 4);
        expiry.value = n.length > 2 ? n.slice(0, 2) + '/' + n.slice(2) : n;
        var ve = $('#visualExpiry');
        if (ve) ve.textContent = expiry.value || 'AA/İİ';
      });
    }
    if (cvv) {
      cvv.addEventListener('input', function () { cvv.value = digits(cvv.value).slice(0, 4); });
    }
    if (holder) {
      holder.addEventListener('input', function () {
        holder.value = holder.value.toUpperCase();
        var vh = $('#visualHolder');
        if (vh) vh.textContent = holder.value || 'AD SOYAD';
      });
    }
  }

  async function post(url, body) {
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    });
    try { return await res.json(); } catch (e) { return { ok: false, message: 'Server cavabı oxunmadı' }; }
  }

  function init() {
    var form = document.getElementById('payForm');
    if (!form) return;
    var orderId = form.getAttribute('data-order-id');
    bindFormatting(form);

    /* Saxlanılmış kart ilə ödəniş */
    Array.prototype.forEach.call(document.querySelectorAll('[data-saved-card]'), function (btn) {
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        note('Saxlanılmış kart göndərilir…', 'info');
        var r = await post('/api/payment/saved-card/init', {
          orderId: orderId,
          savedCardId: btn.getAttribute('data-saved-card')
        });
        if (r.ok && r.redirect) { window.location.href = r.redirect; return; }
        btn.disabled = false;
        note(r.message || 'Ödəniş başladıla bilmədi', 'error');
      });
    });

    /* Yeni kart ilə ödəniş */
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var card = {
        number: digits(form.querySelector('input[name="number"]').value),
        holder: form.querySelector('input[name="holder"]').value.trim(),
        expiry: form.querySelector('input[name="expiry"]').value.trim(),
        cvv: digits(form.querySelector('input[name="cvv"]').value)
      };
      var saveBox = form.querySelector('input[name="saveCard"]');

      if (!luhn(card.number)) return note('Kart nömrəsi yanlışdır', 'error');
      if (!card.holder) return note('Kart sahibinin adını yazın', 'error');
      if (!expiryValid(card.expiry)) return note('Kartın bitmə tarixi yanlışdır', 'error');
      if (!/^\d{3,4}$/.test(card.cvv)) return note('CVV yanlışdır', 'error');

      var btn = form.querySelector('button[type="submit"]');
      var label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Göndərilir…';
      note('Kart məlumatları bankın doğrulama mərkəzinə göndərilir…', 'info');

      var r = await post('/api/payment/card/init', {
        orderId: orderId,
        card: card,
        saveCard: saveBox ? !!saveBox.checked : true
      });

      if (r.ok && r.redirect) { window.location.href = r.redirect; return; }
      btn.disabled = false;
      btn.innerHTML = label;
      note(r.message || 'Ödəniş başladıla bilmədi', 'error');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
