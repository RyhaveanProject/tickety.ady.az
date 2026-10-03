/* ADY — Auth formaları (Login / Qeydiyyat / Şifrə bərpası)
   Bütün mesajlar cari dildən (window.ADY.dict) götürülür. */
(function () {
  'use strict';

  var T = window.T || function (key, fallback) { return fallback === undefined ? key : fallback; };

  function showNote(note, message, ok) {
    if (!note) return;
    note.classList.remove('hidden');
    note.className = 'alert ' + (ok ? 'alert--success' : 'alert--error') + ' mb-16';
    note.textContent = message;
  }

  function goTo(url) {
    window.location.href = url || '/' + ((window.ADY && window.ADY.locale) || 'az');
  }

  /* ==================== Login (e-mail) ==================== */
  var loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var note = document.getElementById('formNote');
      var btn = loginForm.querySelector('button[type=submit]');
      window.setLoading(btn, true);
      var payload = {
        email: loginForm.querySelector('[name=email]').value,
        password: loginForm.querySelector('[name=password]').value
      };
      try {
        var r = await window.api('/api/auth/login', payload);
        window.setLoading(btn, false);
        if (r.ok) {
          window.toast(r.message || T('msg.welcome', 'Xoş gəlmisiniz'), 'success');
          return goTo(r.redirect);
        }
        showNote(note, r.message || T('msg.loginFailed', 'Giriş alınmadı'), false);
      } catch (err) {
        window.setLoading(btn, false);
        showNote(note, T('msg.networkError', 'Şəbəkə xətası. Yenidən cəhd edin.'), false);
      }
    });
  }

  /* ==================== Qeydiyyat ==================== */
  var registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var note = document.getElementById('formNote');
      var btn = registerForm.querySelector('button[type=submit]');

      var password = registerForm.querySelector('[name=password]').value;
      var passwordRepeat = registerForm.querySelector('[name=passwordRepeat]').value;
      if (password !== passwordRepeat) {
        showNote(note, T('msg.passwordsMismatch', 'Şifrələr uyğun gəlmir'), false);
        return;
      }

      window.setLoading(btn, true);
      var payload = {
        firstName: registerForm.querySelector('[name=firstName]').value,
        lastName: registerForm.querySelector('[name=lastName]').value,
        email: registerForm.querySelector('[name=email]').value,
        password: password,
        passwordRepeat: passwordRepeat,
        phone: registerForm.querySelector('[name=phone]').value
      };
      try {
        var r = await window.api('/api/auth/register', payload);
        window.setLoading(btn, false);
        if (r.ok) {
          window.toast(r.message || T('msg.registerDone', 'Qeydiyyat tamamlandı'), 'success');
          return goTo(r.redirect);
        }
        showNote(note, r.message || T('msg.registerFailed', 'Qeydiyyat alınmadı'), false);
      } catch (err) {
        window.setLoading(btn, false);
        showNote(note, T('msg.networkError', 'Şəbəkə xətası. Yenidən cəhd edin.'), false);
      }
    });
  }

  /* ==================== Şifrəni unutdum ==================== */
  var forgotForm = document.getElementById('forgotForm');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = forgotForm.querySelector('button[type=submit]');
      window.setLoading(btn, true);
      var email = forgotForm.querySelector('[name=email]').value;
      try {
        var r = await window.api('/api/auth/forgot', { email: email });
        window.setLoading(btn, false);
        window.toast(r.message || T('msg.codeSent', 'Bərpa kodu göndərildi'), r.ok ? 'success' : 'error');
        if (r.ok) {
          var resetBox = document.getElementById('resetBox');
          if (resetBox) {
            resetBox.classList.remove('hidden');
            var resetEmail = document.getElementById('resetEmail');
            if (resetEmail) resetEmail.value = email;
            if (r.token) {
              var codeInput = resetBox.querySelector('[data-code]');
              if (codeInput) codeInput.value = r.token;
            }
          }
        }
      } catch (err) {
        window.setLoading(btn, false);
        window.toast(T('msg.networkError', 'Şəbəkə xətası. Yenidən cəhd edin.'), 'error');
      }
    });
  }

  /* ==================== Yeni şifrə təyini ==================== */
  var resetForm = document.getElementById('resetForm');
  if (resetForm) {
    resetForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var note = document.getElementById('formNote');
      var btn = resetForm.querySelector('button[type=submit]');
      window.setLoading(btn, true);
      var payload = {
        email: resetForm.querySelector('[name=email]').value,
        code: resetForm.querySelector('[name=code]').value,
        password: resetForm.querySelector('[name=password]').value
      };
      try {
        var r = await window.api('/api/auth/reset', payload);
        window.setLoading(btn, false);
        if (r.ok) {
          window.toast(r.message || T('msg.passwordUpdated', 'Şifrə yeniləndi'), 'success');
          return goTo(r.redirect);
        }
        showNote(note, r.message || T('msg.operationFailed', 'Əməliyyat alınmadı'), false);
      } catch (err) {
        window.setLoading(btn, false);
        showNote(note, T('msg.networkError', 'Şəbəkə xətası. Yenidən cəhd edin.'), false);
      }
    });
  }
})();
