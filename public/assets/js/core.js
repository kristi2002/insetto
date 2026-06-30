/* ============================================================
   core.js — libreria comune (AJAX + CSRF, toast, modal, util).
   Richiede jQuery. Espone window.App.
   ============================================================ */
(function ($) {
  'use strict';

  const App = {
    csrf: null,
    user: null,
    base: window.BASE_URL || '',
  };

  /* ---------- API: wrapper $.ajax con CSRF ---------- */
  // apiGet(url, data) / apiSend(method, url, body)
  App.apiGet = function (url, data) {
    return $.ajax({
      url: App.base + url,
      method: 'GET',
      data: data || {},
      dataType: 'json',
    });
  };

  App.apiSend = function (method, url, body) {
    return $.ajax({
      url: App.base + url,
      method: method,
      contentType: 'application/json; charset=utf-8',
      data: JSON.stringify(body || {}),
      dataType: 'json',
      headers: { 'X-CSRF-Token': App.csrf || '' },
    });
  };
  App.apiPost   = function (url, body) { return App.apiSend('POST', url, body); };
  App.apiPut    = function (url, body) { return App.apiSend('PUT', url, body); };
  App.apiDelete = function (url, body) { return App.apiSend('DELETE', url, body); };

  /* Estrae un messaggio d'errore leggibile da una risposta jqXHR. */
  App.errMsg = function (xhr) {
    if (xhr && xhr.responseJSON && xhr.responseJSON.error) return xhr.responseJSON.error;
    if (xhr && xhr.status === 0) return 'Connessione non disponibile';
    return 'Errore imprevisto (' + (xhr ? xhr.status : '?') + ')';
  };

  /* ---------- Sessione ---------- */
  // Carica utente + csrf; se non loggato => redirect al login (salvo opt-out).
  App.loadSession = function (opts) {
    opts = opts || {};
    return App.apiGet('/api/auth.php?action=me').then(function (res) {
      App.user = res.user;
      App.csrf = res.csrf;
      if (!res.user && !opts.allowAnon) {
        window.location.href = App.base + '/login.php';
        return $.Deferred().reject().promise();
      }
      return res;
    });
  };

  App.logout = function () {
    App.apiPost('/api/auth.php?action=logout').always(function () {
      window.location.href = App.base + '/login.php';
    });
  };

  /* ---------- Toast ---------- */
  App.toast = function (msg, type) {
    let $c = $('#toasts');
    if (!$c.length) { $c = $('<div id="toasts"></div>').appendTo('body'); }
    const $t = $('<div class="toast"></div>').addClass(type || '').text(msg);
    $c.append($t);
    setTimeout(function () { $t.fadeOut(200, function () { $(this).remove(); }); }, 3200);
  };
  App.ok  = function (m) { App.toast(m, 'ok'); };
  App.err = function (m) { App.toast(m, 'err'); };

  /* ---------- Util ---------- */
  App.esc = function (s) {
    return $('<div>').text(s == null ? '' : s).html();
  };
  App.initials = function (name) {
    if (!name) return '?';
    const p = String(name).trim().split(/\s+/);
    return ((p[0] || '')[0] || '' ) + (p.length > 1 ? (p[p.length - 1][0] || '') : '');
  };
  App.debounce = function (fn, ms) {
    let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 250); };
  };

  // Copia testo negli appunti (con fallback per contesti non sicuri).
  App.copy = function (text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); resolve();
      } catch (e) { reject(e); }
    });
  };

  /* ---------- Modal generico ---------- */
  // App.modal({ title, bodyHtml, okText, onOk(closeFn), okClass })
  App.modal = function (cfg) {
    $('.modal-backdrop').remove();
    const $bd = $(
      '<div class="modal-backdrop open">' +
        '<div class="modal">' +
          '<div class="modal-head"><h3></h3><button class="x" aria-label="Chiudi">&times;</button></div>' +
          '<div class="modal-body"></div>' +
          '<div class="modal-foot">' +
            '<button class="btn js-cancel">Annulla</button>' +
            '<button class="btn primary js-ok"></button>' +
          '</div>' +
        '</div>' +
      '</div>'
    ).appendTo('body');

    $bd.find('h3').text(cfg.title || '');
    $bd.find('.modal-body').html(cfg.bodyHtml || '');
    $bd.find('.js-ok').text(cfg.okText || 'Salva').addClass(cfg.okClass || '');
    if (cfg.hideOk) $bd.find('.js-ok').remove();
    if (cfg.cancelText === null) $bd.find('.js-cancel').remove();
    else if (cfg.cancelText) $bd.find('.js-cancel').text(cfg.cancelText);

    const close = function () { $bd.remove(); };
    $bd.find('.x, .js-cancel').on('click', close);
    $bd.on('mousedown', function (e) { if (e.target === $bd[0]) close(); });
    $bd.find('.js-ok').on('click', function () {
      if (cfg.onOk) cfg.onOk(close, $bd); else close();
    });
    if (cfg.onOpen) cfg.onOpen($bd);
    return { el: $bd, close: close };
  };

  // Conferma sì/no
  App.confirm = function (title, msg, onYes, yesText) {
    App.modal({
      title: title,
      bodyHtml: '<p>' + App.esc(msg) + '</p>',
      okText: yesText || 'Conferma',
      okClass: 'danger',
      onOk: function (close) { close(); onYes(); },
    });
  };

  /* ---------- Render helpers ---------- */
  App.loadingHtml = '<div class="loading"><div class="spinner"></div>Caricamento…</div>';
  App.emptyHtml = function (msg, icon) {
    return '<div class="empty"><div class="big">' + (icon || '📭') + '</div>' + App.esc(msg) + '</div>';
  };

  window.App = App;
})(jQuery);
