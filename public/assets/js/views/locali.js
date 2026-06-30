/* locali.js — scheda cliente: profilo + tab + asset (locali).
   Route: #/locali/:clienteId */
(function ($) {
  'use strict';
  App.views = App.views || {};

  let clienteId = null;
  let cliente = null;
  let activeTab = 'locali';

  /* ---------- Icone (muted, stroke currentColor) ---------- */
  const ICON = {
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="8.01" y2="6"/><line x1="12" y1="6" x2="12.01" y2="6"/><line x1="16" y1="6" x2="16.01" y2="6"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="12" y1="10" x2="12.01" y2="10"/><line x1="16" y1="10" x2="16.01" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    chart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    ruler: '<path d="M3 3h18v6H3z"/><path d="M7 9v2M11 9v2M15 9v2M19 9v2"/>',
    euro: '<path d="M18 7a6 6 0 1 0 0 10"/><line x1="4" y1="11" x2="13" y2="11"/><line x1="4" y1="14" x2="11" y2="14"/>',
  };
  function svg(name, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>';
  }

  function statoBadge(s) {
    const cls = s === 'attivo' ? 'green' : (s === 'archiviato' ? 'gray' : 'warn');
    return '<span class="badge ' + cls + '">' + App.esc(s) + '</span>';
  }

  /* ---------- Render ---------- */
  function render($view, arg) {
    clienteId = parseInt(arg, 10);
    if (!clienteId) { location.hash = '#/clienti'; return; }
    activeTab = 'locali';
    $view.html(App.loadingHtml);
    App.apiGet('/api/clienti.php?action=get', { id: clienteId }).done(function (res) {
      cliente = res.cliente;
      paint($view);
    }).fail(function (xhr) { $view.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  const TABS = [
    ['locali', 'Locali', 'building'],
    ['fatture', 'Fatture', 'file'],
    ['contratti', 'Contratti', 'folder'],
    ['documenti', 'Documenti', 'file'],
    ['comunicazioni', 'Comunicazioni', 'msg'],
    ['promemoria', 'Promemoria', 'bell'],
  ];

  function paint($view) {
    const c = cliente;
    const nLoc = (c.locali || []).length;

    const contacts =
      '<div class="contact-row">' + svg('phone') + '<span>' + App.esc(c.telefono || '—') + '</span></div>' +
      '<div class="contact-row">' + svg('mail') + '<span>' + App.esc(c.email || '—') + '</span></div>' +
      '<div class="contact-row">' + svg('building') + '<span>' + nLoc + ' local' + (nLoc === 1 ? 'e' : 'i') + '</span></div>';

    const note = c.note_interne
      ? '<div class="note-box"><div class="note-lbl">NOTE INTERNE</div><div>' + App.esc(c.note_interne) + '</div></div>'
      : '<div class="note-box empty"><div class="note-lbl">NOTE INTERNE</div><div class="muted">Nessuna nota.</div></div>';

    const tabs = TABS.map(function (t) {
      return '<button class="ctab' + (activeTab === t[0] ? ' active' : '') + '" data-tab="' + t[0] + '">' +
        svg(t[2]) + '<span>' + App.esc(t[1]) + '</span></button>';
    }).join('');

    $view.html(
      '<button class="btn-back" id="btnBack">' + svg('back') + ' Clienti</button>' +

      '<div class="profile-header">' +
        '<div class="ph-main">' +
          '<div class="ph-avatar">' + App.esc(App.initials(c.ragione_sociale)) + '</div>' +
          '<div class="ph-info">' +
            '<div class="ph-name-row"><h1 class="ph-name">' + App.esc(c.ragione_sociale) + '</h1>' + statoBadge(c.stato) + '</div>' +
            (c.partita_iva ? '<div class="ph-sub">P.IVA ' + App.esc(c.partita_iva) + '</div>' : '') +
            '<div class="ph-contacts">' + contacts + '</div>' +
          '</div>' +
          '<div class="ph-actions">' +
            '<button class="btn ghost" id="btnEditCli">' + svg('pencil') + ' Modifica</button>' +
            '<button class="btn ghost" id="btnRendiconto">' + svg('chart') + ' Rendiconto</button>' +
          '</div>' +
        '</div>' +
        note +
      '</div>' +

      '<div class="ctabs">' + tabs + '</div>' +
      '<div id="tabContent"></div>'
    );

    $view.find('#btnBack').on('click', function () { location.hash = '#/clienti'; });
    $view.find('#btnEditCli').on('click', function () {
      App.formReturn = '#/locali/' + clienteId;   // torna alla scheda dopo il salvataggio
      location.hash = '#/clienti-form/' + clienteId;
    });
    $view.find('#btnRendiconto').on('click', rendiconto);
    $view.find('.ctab').on('click', function () { activeTab = $(this).data('tab'); paint($view); });

    renderTab();
  }

  /* ---------- Tab content ---------- */
  function renderTab() {
    const $c = $('#tabContent');
    if (activeTab === 'locali') return renderLocali($c);
    if (activeTab === 'fatture') return renderFatture($c);
    // Placeholder per le tab non ancora attive
    const labels = { contratti: 'Contratti', documenti: 'Documenti', comunicazioni: 'Comunicazioni', promemoria: 'Promemoria' };
    $c.html(App.emptyHtml('Sezione "' + (labels[activeTab] || activeTab) + '" in arrivo.', '🗂️'));
  }

  /* ---------- Tab LOCALI (asset) ---------- */
  function renderLocali($c) {
    const locali = cliente.locali || [];
    const n = locali.length;
    let html =
      '<div class="assets-head">' +
        '<div class="assets-count">' + n + ' local' + (n === 1 ? 'e associato' : 'i associati') + '</div>' +
        '<button class="btn primary" id="btnAddLoc">+ Aggiungi locale</button>' +
      '</div>';
    if (!n) { html += App.emptyHtml('Nessun locale. Aggiungine uno.', '🏬'); }
    else { html += '<div class="asset-grid">' + locali.map(assetCard).join('') + '</div>'; }
    $c.html(html);
    $c.find('#btnAddLoc').on('click', function () { location.hash = '#/locale-form/' + clienteId; });
  }

  function assetCard(l) {
    const photo = l.foto_path
      ? '<div class="asset-photo" style="background-image:url(\'' + App.esc(l.foto_path) + '\')"></div>'
      : '<div class="asset-photo placeholder">' + svg('building', 'big') + '</div>';
    return '' +
      '<div class="asset-card" data-id="' + l.id + '">' +
        photo +
        '<div class="asset-body">' +
          '<div class="asset-title">' + App.esc(l.nome) + '</div>' +
          '<div class="asset-addr">' + svg('pin') + '<span>' + App.esc(l.indirizzo || 'Indirizzo non specificato') + '</span></div>' +
          '<div class="asset-foot">' +
            statoBadge(l.stato) +
          '</div>' +
          '<div class="asset-actions">' +
            '<button class="btn small primary js-manage" data-id="' + l.id + '">Gestisci</button> ' +
            '<button class="btn small js-editloc" data-id="' + l.id + '">Modifica</button> ' +
            '<button class="btn small danger js-delloc" data-id="' + l.id + '">Elimina</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  $(document).on('click', '#tabContent .js-manage', function (e) { e.stopPropagation(); location.hash = '#/locale/' + $(this).data('id'); });
  $(document).on('click', '#tabContent .js-editloc', function (e) {
    e.stopPropagation();
    location.hash = '#/locale-form/' + clienteId + '/' + $(this).data('id');
  });
  $(document).on('click', '#tabContent .js-delloc', function (e) {
    e.stopPropagation();
    const id = $(this).data('id');
    App.confirm('Elimina locale', 'Eliminare il locale e tutte le sue aree/postazioni?', function () {
      App.apiPost('/api/locali.php?action=delete&id=' + id).done(function () { App.ok('Locale eliminato'); reloadCliente(); })
        .fail(function (xhr) { App.err(App.errMsg(xhr)); });
    }, 'Elimina');
  });

  /* ---------- Tab FATTURE (documenti del cliente) ---------- */
  function renderFatture($c) {
    $c.html(App.loadingHtml);
    App.apiGet('/api/documenti.php?action=list', { cliente_id: clienteId }).done(function (res) {
      const docs = res.documenti || [];
      if (!docs.length) { $c.html(App.emptyHtml('Nessun documento per questo cliente.', '🧾')); return; }
      $c.html('<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>Numero</th><th>Tipo</th><th>Data</th><th>Totale</th><th>Stato</th></tr></thead><tbody>' +
        docs.map(function (d) {
          return '<tr><td><strong>' + App.esc(d.numero || '—') + '</strong></td><td>' + App.esc(d.tipo) +
            '</td><td>' + App.esc(d.data) + '</td><td>€ ' + (+d.totale).toFixed(2) + '</td><td>' + App.esc(d.stato) + '</td></tr>';
        }).join('') + '</tbody></table></div>');
    }).fail(function (xhr) { $c.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  /* ---------- Helpers ---------- */
  function reloadCliente() {
    App.apiGet('/api/clienti.php?action=get', { id: clienteId }).done(function (res) {
      cliente = res.cliente; paint($('#view'));
    });
  }

  function rendiconto() {
    const nLoc = (cliente.locali || []).length;
    App.modal({
      title: 'Rendiconto · ' + cliente.ragione_sociale,
      bodyHtml: '<p class="muted">Riepilogo sintetico del cliente.</p>' +
        '<div class="row"><span class="k">Locali</span><span>' + nLoc + '</span></div>' +
        '<div class="row"><span class="k">Stato</span><span>' + App.esc(cliente.stato) + '</span></div>' +
        '<p class="muted" style="margin-top:10px">Il rendiconto completo (interventi, consumi, importi) sarà collegato a questa sezione.</p>',
      hideOk: true, cancelText: 'Chiudi',
    });
  }

  App.views['locali'] = { render: render };
})(jQuery);
