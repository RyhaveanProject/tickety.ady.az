/* ADY Ticket Clone — əsas istifadəçi skripti */
(function () {
  'use strict';

  /* ==================== Tərcümə köməkçisi ====================
     Lüğət serverdən window.ADY.dict kimi ötürülür (layout/main.ejs).
     Açar tapılmasa, ehtiyat mətn göstərilir. */
  function T(key, fallback) {
    var d = (window.ADY && window.ADY.dict) || {};
    var v = d[key];
    if (v === undefined || v === null || v === '') v = fallback;
    return v === undefined ? key : v;
  }
  window.T = T;

  /* ==================== Toast ==================== */
  const toastEl = document.getElementById('toast');
  let toastTimer = null;
  window.toast = function (message, type) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = 'toast is-show' + (type ? ' toast--' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 4200);
  };

  /* ==================== Fetch köməkçisi ==================== */
  window.api = async function (url, data, method) {
    const opts = {
      method: method || (data ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin'
    };
    if (data) opts.body = JSON.stringify(data);
    const res = await fetch(url, opts);
    let json = {};
    try { json = await res.json(); } catch (e) { json = { ok: false, message: T('msg.serverResponse', 'Server cavabı oxunmadı.') }; }
    return json;
  };

  /* ==================== Düymə loading ==================== */
  window.setLoading = function (btn, on) {
    if (!btn) return;
    if (on) { btn.classList.add('is-loading'); btn.disabled = true; }
    else { btn.classList.remove('is-loading'); btn.disabled = false; }
  };

  /* ==================== Burger menyu ==================== */
  const burger = document.getElementById('burger');
  const mainNav = document.getElementById('mainNav');
  if (burger && mainNav) {
    burger.addEventListener('click', () => {
      const open = mainNav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ==================== İstifadəçi menyusu ==================== */
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = userDropdown.classList.toggle('is-open');
      userMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!userDropdown.contains(e.target) && e.target !== userMenuBtn) {
        userDropdown.classList.remove('is-open');
      }
    });
  }

  /* ==================== Çıxış ==================== */
  document.querySelectorAll('[data-logout]').forEach((el) => {
    el.addEventListener('click', async () => {
      const r = await window.api('/api/auth/logout', {});
      if (r.ok) window.location.href = r.redirect || '/' + ((window.ADY && window.ADY.locale) || 'az');
    });
  });

  /* ==================== Abunə forması (bütün nüsxələr — footer və ana səhifə) ==================== */
  document.querySelectorAll('#subscribeForm, form.subscribe').forEach((form) => {
    if (form.dataset.subBound) return;
    form.dataset.subBound = '1';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input[name=email]');
      const note = document.getElementById('subscribeNote');
      const r = await window.api('/api/subscribe', { email: input.value });
      const okMsg = r.message || T('msg.subscribed', 'Abunəliyiniz qeydə alındı');
      const errMsg = r.message || T('msg.error', 'Xəta baş verdi');
      if (note) {
        note.textContent = r.ok ? okMsg : errMsg;
        note.style.color = r.ok ? '#7ee2a8' : '#ff9c93';
      } else {
        window.toast(r.ok ? okMsg : errMsg, r.ok ? 'success' : 'error');
      }
      if (r.ok) input.value = '';
    });
  });

  /* ==================== Stansiya combo (autocomplete) ==================== */
  const stations = window.ADY_STATIONS || [];
  document.querySelectorAll('[data-combo]').forEach((combo) => {
    const input = combo.querySelector('[data-combo-input]');
    const list = combo.querySelector('[data-combo-list]');
    const clear = combo.querySelector('[data-combo-clear]');
    if (!input || !list) return;
    let activeIdx = -1;

    const norm = (s) => (s || '').toLowerCase()
      .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ş/g, 's')
      .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u');

    function render(items) {
      list.innerHTML = '';
      if (!items.length) { list.innerHTML = '<div class="combo__item">' + T('msg.resultNotFound', 'Nəticə tapılmadı') + '</div>'; return; }
      items.forEach((s) => {
        const div = document.createElement('div');
        div.className = 'combo__item';
        div.innerHTML = '<span>' + s.name + '</span><small>' + s.code + (s.region ? ' · ' + s.region : '') + '</small>';
        div.addEventListener('mousedown', (e) => {
          e.preventDefault();
          input.value = s.name;
          input.dataset.code = s.code;
          list.parentElement.classList.remove('is-open');
          combo.classList.add('has-value');
        });
        list.appendChild(div);
      });
    }

    function filter(q) {
      const nq = norm(q);
      if (!q) return stations.slice(0, 40);
      return stations.filter((s) => norm(s.name).includes(nq) || norm(s.nameEn || '').includes(nq) || norm(s.code).includes(nq)).slice(0, 40);
    }

    input.addEventListener('focus', () => {
      render(filter(input.value));
      combo.classList.add('is-open');
    });
    input.addEventListener('input', () => {
      combo.classList.add('has-value');
      render(filter(input.value));
      combo.classList.add('is-open');
    });
    input.addEventListener('blur', () => setTimeout(() => combo.classList.remove('is-open'), 160));
    input.addEventListener('keydown', (e) => {
      const items = list.querySelectorAll('.combo__item');
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); }
      else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); items[activeIdx].dispatchEvent(new Event('mousedown')); return; }
      else return;
      items.forEach((it, i) => it.classList.toggle('is-active', i === activeIdx));
      items[activeIdx].scrollIntoView({ block: 'nearest' });
    });
    if (clear) {
      clear.addEventListener('click', () => {
        input.value = ''; input.dataset.code = '';
        combo.classList.remove('has-value');
        input.focus();
      });
    }
    if (input.value) combo.classList.add('has-value');
  });

  /* ==================== Yerləri dəyiş ==================== */
  const swapBtn = document.getElementById('swapBtn');
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      const a = document.getElementById('fromInput');
      const b = document.getElementById('toInput');
      if (!a || !b) return;
      const tmp = a.value; a.value = b.value; b.value = tmp;
      const tc = a.dataset.code; a.dataset.code = b.dataset.code; b.dataset.code = tc;
    });
  }

  /* ==================== Axtarış: kodu stansiyaya çevir ==================== */
  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      const from = document.getElementById('fromInput');
      const to = document.getElementById('toInput');
      if (!from.value || !to.value) { e.preventDefault(); window.toast(T('msg.stationsSelected', 'Stansiyaları seçin'), 'error'); return; }
      const byName = (v) => {
        const f = stations.find((s) => s.name === v || s.code === v);
        return f ? f.code : v;
      };
      from.value = byName(from.value);
      to.value = byName(to.value);
      if (from.value === to.value) {
        e.preventDefault();
        window.toast(T('msg.sameStations', 'Gediş və təyinat stansiyaları fərqli olmalıdır'), 'error');
      }
    });
  }

  /* ==================== Cədvəl tabları ==================== */
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.getAttribute('data-tab-group') || 'default';
      document.querySelectorAll('[data-tab-group="' + group + '"]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const target = btn.getAttribute('data-tab');
      document.querySelectorAll('[data-panel-group="' + group + '"]').forEach((p) => {
        p.classList.toggle('is-active', p.getAttribute('data-panel') === target);
      });
    });
  });

  /* ==================== FAQ ==================== */
  document.querySelectorAll('.faq__q').forEach((q) => {
    q.addEventListener('click', () => q.parentElement.classList.toggle('is-open'));
  });

  /* ==================== Sifariş ləğvi / bilet qaytarma ==================== */
  document.querySelectorAll('[data-refund]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(T('msg.refundConfirm', 'Bileti qaytarmaq istədiyinizə əminsiniz? Xidmət haqqı tutulacaq.'))) return;
      window.setLoading(btn, true);
      const r = await window.api('/api/booking/refund', { ticketId: btn.getAttribute('data-refund') });
      window.setLoading(btn, false);
      window.toast(r.message || (r.ok ? T('msg.refunded', 'Bilet qaytarıldı') : T('msg.error', 'Xəta')), r.ok ? 'success' : 'error');
      if (r.ok) setTimeout(() => window.location.reload(), 1300);
    });
  });

  document.querySelectorAll('[data-cancel-order]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(T('msg.cancelConfirm', 'Sifarişi ləğv etmək istəyirsiniz?'))) return;
      const r = await window.api('/api/booking/cancel', { orderId: btn.getAttribute('data-cancel-order') });
      window.toast(r.message, r.ok ? 'success' : 'error');
      if (r.ok) setTimeout(() => window.location.href = r.redirect || '/', 1100);
    });
  });

  /* ==================== Bilet yoxlama ==================== */
  const verifyForm = document.getElementById('verifyForm');
  if (verifyForm) {
    verifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = verifyForm.querySelector('input[name=pnr]');
      const box = document.getElementById('verifyResult');
      const btn = verifyForm.querySelector('button[type=submit]');
      window.setLoading(btn, true);
      const r = await window.api('/api/tickets/verify', { pnr: input.value });
      window.setLoading(btn, false);
      if (r.ok) {
        const t = r.ticket;
        box.innerHTML =
          '<div class="alert alert--success"><strong>' + T('msg.ticketFound', 'Bilet tapıldı') + '</strong> — ' + T('verify.status', 'Status') + ': ' + t.status + '</div>' +
          '<dl class="kv">' +
          '<dt>PNR</dt><dd>' + t.pnr + '</dd>' +
          '<dt>' + T('verify.passenger', 'Sərnişin') + '</dt><dd>' + t.passengerName + '</dd>' +
          '<dt>' + T('verify.train', 'Qatar') + '</dt><dd>' + t.trainNumber + '</dd>' +
          '<dt>' + T('verify.route', 'Marşrut') + '</dt><dd>' + t.fromName + ' → ' + t.toName + '</dd>' +
          '<dt>' + T('verify.date', 'Tarix') + '</dt><dd>' + t.date + ' ' + t.departTime + '</dd>' +
          '<dt>' + T('verify.seat', 'Vaqon / Yer') + '</dt><dd>' + t.wagon + ' / ' + t.seat + ' (' + t.className + ')</dd>' +
          '</dl>';
      } else {
        box.innerHTML = '<div class="alert alert--error">' + (r.message || T('msg.ticketNotFound', 'Bilet tapılmadı')) + '</div>';
      }
    });
  }

  /* ==================== Xəbərdarlıq zolağı — × düyməsi ==================== */
  const noticeClose = document.getElementById('noticeClose');
  const noticeBar = document.getElementById('noticeBar');
  if (noticeClose && noticeBar) {
    noticeClose.addEventListener('click', function () {
      noticeBar.classList.add('is-closing');
      setTimeout(function () { noticeBar.remove(); }, 220);
    });
  }

  /* ==================== Rəqəm formatlama ==================== */
  window.fmt = function (n) { return Number(n || 0).toFixed(2); };

})();
