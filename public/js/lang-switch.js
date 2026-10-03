/* ADY — Səhifəni yenidən yükləmədən dil dəyişdirici.
   Yeni dildəki səhifə arxa planda yüklənir, mətnlər və linklər mövcud səhifədə
   yerində dəyişdirilir (formalar, yazılmış dəyərlər, düymə hadisələri qorunur).
   Struktur fərqlidirsə, ehtiyat variant kimi normal keçid edilir. */
(function () {
  'use strict';
  var ATTRS = ['href', 'placeholder', 'title', 'aria-label', 'alt', 'content', 'data-lang', 'action', 'label'];
  var busy = false;

  function setCookie(l) {
    document.cookie = 'locale=' + l + ';path=/;max-age=' + (365 * 24 * 60 * 60) + ';samesite=lax';
    try { localStorage.setItem('ady_locale', l); } catch (e) {}
  }

  /* İki DOM ağacını paralel gəzir; struktur uyğun gəlmirsə false qaytarır */
  function sameShape(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType === 1 && a.tagName !== b.tagName) return false;
    if (a.nodeType === 1 && (a.tagName === 'SCRIPT' || a.tagName === 'STYLE' || a.tagName === 'svg' || a.tagName === 'SVG')) return true;
    var ca = a.childNodes, cb = b.childNodes;
    if (ca.length !== cb.length) return false;
    for (var i = 0; i < ca.length; i++) if (!sameShape(ca[i], cb[i])) return false;
    return true;
  }

  function patch(a, b) {
    if (a.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    if (a.nodeType !== 1) return;
    if (a.tagName === 'SCRIPT' || a.tagName === 'STYLE' || a.tagName === 'svg' || a.tagName === 'SVG') return;
    ATTRS.forEach(function (n) {
      var v = b.getAttribute(n);
      if (v !== null && a.getAttribute(n) !== v) a.setAttribute(n, v);
    });
    if (a.classList && a.classList.contains('lang__item')) a.className = b.className;
    /* düymə/option mətni (value) — istifadəçinin yazdığı input dəyərlərinə toxunulmur */
    if ((a.tagName === 'INPUT' && /^(submit|button)$/i.test(a.type)) || a.tagName === 'OPTION') {
      var bv = b.getAttribute('value');
      if (bv !== null && a.tagName === 'INPUT') a.value = bv;
    }
    for (var i = 0; i < a.childNodes.length; i++) patch(a.childNodes[i], b.childNodes[i]);
  }

  function readADY(doc) {
    var scripts = doc.querySelectorAll('script:not([src])');
    for (var i = 0; i < scripts.length; i++) {
      var t = scripts[i].textContent;
      if (t.indexOf('window.ADY') > -1) {
        try { var w = {}; new Function('window', t)(w); return w.ADY; } catch (e) { return null; }
      }
    }
    return null;
  }

  async function switchTo(url, lang, push) {
    if (busy) return;
    busy = true;
    document.documentElement.classList.add('is-lang-switching');
    try {
      setCookie(lang);
      var res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { 'X-Lang-Switch': '1' } });
      if (!res.ok || res.redirected) throw new Error('fallback');
      var html = await res.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var parts = ['header', '.topbar', 'main', 'footer'];
      var pairs = [];
      for (var i = 0; i < parts.length; i++) {
        var a = document.querySelector(parts[i]), b = doc.querySelector(parts[i]);
        if (!a && !b) continue;
        if (!a || !b || !sameShape(a, b)) throw new Error('fallback: ' + parts[i]);
        pairs.push([a, b]);
      }
      pairs.forEach(function (p) { patch(p[0], p[1]); });
      document.title = doc.title;
      document.documentElement.lang = lang;
      var ady = readADY(doc);
      if (ady && window.ADY) { window.ADY.locale = ady.locale; window.ADY.dateLocale = ady.dateLocale; window.ADY.dict = ady.dict; }
      if (push) history.pushState({ lang: lang }, '', url);
      document.dispatchEvent(new CustomEvent('ady:locale-changed', { detail: { locale: lang } }));
    } catch (e) {
      if (window.console) console.warn('[lang]', e.message);
      window.location.assign(url);
    } finally {
      busy = false;
      document.documentElement.classList.remove('is-lang-switching');
    }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.lang__item');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    var lang = a.getAttribute('data-lang');
    if (!lang) return;
    e.preventDefault();
    if (lang === document.documentElement.lang) return;
    switchTo(a.getAttribute('href'), lang, true);
  });

  window.addEventListener('popstate', function () {
    var m = location.pathname.match(/^\/(az|en|ru)(?=\/|$)/);
    if (m && m[1] !== document.documentElement.lang) switchTo(location.href, m[1], false);
  });
})();
