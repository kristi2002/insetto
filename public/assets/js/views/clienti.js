/* clienti.js — griglia card clienti (4 col desktop, responsive, AJAX/SPA). */
(function ($) {
  'use strict';
  App.views = App.views || {};

  const STATI = ['attivo', 'inattivo', 'archiviato'];
  let selected = new Set();   // id clienti selezionati (azioni bulk)

  /* ---------- Icone (muted, stroke currentColor) ---------- */
  const ICON = {
    card: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="8.01" y2="6"/><line x1="12" y1="6" x2="12.01" y2="6"/><line x1="16" y1="6" x2="16.01" y2="6"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="12" y1="10" x2="12.01" y2="10"/><line x1="16" y1="10" x2="16.01" y2="10"/>',
    open: '<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    chevron: '<polyline points="6 9 12 15 18 9"/>',
  };
  const FREQ = ['Mensile', 'Bimestrale', 'Trimestrale', 'Semestrale', 'Annuale', 'Altro'];
  function svg(name, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>';
  }

  function statoBadge(s) {
    const cls = s === 'attivo' ? 'green' : (s === 'archiviato' ? 'gray' : 'warn');
    const txt = s === 'attivo' ? 'Attivo' : (s === 'archiviato' ? 'Archiviato' : 'Inattivo');
    return '<span class="badge ' + cls + '">' + txt + '</span>';
  }

  function render($view) {
    $view.html(
      '<div class="page-head">' +
        '<div><h1>Clienti</h1><div class="sub">Anagrafica clienti e relativi locali</div></div>' +
        '<button class="btn primary" id="btnNew">+ Nuovo cliente</button>' +
      '</div>' +
      // Pannello filtri collassabile
      '<div class="filter-card expanded" id="filterCard">' +
        '<div class="filter-head" id="filterToggle">' +
          '<span class="filter-title">Filtri</span>' +
          svg('chevron', 'chevron') +
        '</div>' +
        '<div class="filter-body">' +
          '<input class="input" id="q" placeholder="Cerca per ragione sociale, P.IVA, email…">' +
          '<select class="select" id="fLocale"><option value="">Tutti i locali</option></select>' +
          '<select class="select" id="fFreq">' +
            '<option value="">Tutte le frequenze</option>' +
            FREQ.map(function (f) { return '<option value="' + f + '">' + f + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
      '</div>' +

      // Chip di stato (single-select)
      '<div class="chips" id="chips">' +
        '<button class="chip active" data-stato="">Tutti</button>' +
        '<button class="chip" data-stato="attivo">Attivi</button>' +
        '<button class="chip" data-stato="inattivo">Inattivi</button>' +
        '<button class="chip" data-stato="archiviato">Archiviati</button>' +
      '</div>' +
      '<div class="results-count" id="resultsCount"></div>' +

      '<div id="list">' + App.loadingHtml + '</div>' +
      '<div class="bulkbar" id="bulkbar">' +
        '<span class="bulkbar-count"><strong id="bulkCount">0</strong> selezionati</span>' +
        '<button class="btn small" id="bulkClear">Deseleziona</button>' +
        '<button class="btn small danger" id="bulkArchive">Archivia selezionati</button>' +
      '</div>'
    );
    $view.find('#btnNew').on('click', function () { location.hash = '#/clienti-form'; });
    $view.find('#filterToggle').on('click', function () { $('#filterCard').toggleClass('expanded'); });
    $view.find('#q').on('input', App.debounce(load, 250));
    $view.find('#fLocale, #fFreq').on('change', load);
    $view.find('#chips').on('click', '.chip', function () {
      $('#chips .chip').removeClass('active'); $(this).addClass('active'); load();
    });
    $view.find('#bulkClear').on('click', clearSelection);
    $view.find('#bulkArchive').on('click', bulkArchive);

    // Popola il select dei locali
    App.apiGet('/api/locali.php?action=all').done(function (res) {
      const opts = (res.locali || []).map(function (l) {
        return '<option value="' + l.id + '">' + App.esc(l.cliente_nome + ' — ' + l.nome) + '</option>';
      }).join('');
      $('#fLocale').append(opts);
    });

    load();
  }

  /* ---------- Selezione multipla ---------- */
  function updateBulkBar() {
    $('#bulkCount').text(selected.size);
    $('#bulkbar').toggleClass('show', selected.size > 0);
  }
  function clearSelection() {
    selected.clear();
    $('#list .cc-check').prop('checked', false);
    $('#list .client-card').removeClass('selected');
    updateBulkBar();
  }
  function bulkArchive() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const plural = ids.length === 1 ? 'e' : 'i';
    App.confirm('Archivia selezionati', 'Archiviare ' + ids.length + ' client' + plural + ' selezionat' + (ids.length === 1 ? 'o' : 'i') + '?', function () {
      let done = 0, ok = 0;
      ids.forEach(function (id) {
        App.apiPost('/api/clienti.php?action=archive&id=' + id)
          .done(function () { ok++; })
          .always(function () {
            done++;
            if (done === ids.length) {
              App.ok('Archiviati ' + ok + '/' + ids.length);
              const toRefresh = ids.slice();
              clearSelection();
              toRefresh.forEach(refreshCard);
            }
          });
      });
    }, 'Archivia');
  }

  function load() {
    const $list = $('#list');
    App.apiGet('/api/clienti.php?action=list', {
      q: $('#q').val() || '',
      stato: $('#chips .chip.active').data('stato') || '',
      locale_id: $('#fLocale').val() || '',
      frequenza: $('#fFreq').val() || '',
    }).done(function (res) {
      selected.clear(); updateBulkBar();   // i checkbox si azzerano al ridisegno
      const items = res.clienti || [];
      setCount(items.length);
      if (!items.length) { $list.html(App.emptyHtml('Nessun cliente trovato', '🏢')); return; }
      $list.html('<div class="client-grid">' + items.map(cardHtml).join('') + '</div>');
    }).fail(function (xhr) { setCount(0); $list.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  function setCount(n) { $('#resultsCount').text(n + ' risultat' + (n === 1 ? 'o' : 'i')); }

  /* ---------- Card ---------- */
  function bodyRow(icon, value, copyValue, isMail) {
    if (!value) {
      return '<div class="cc-row"><span class="cc-ic">' + svg(icon) + '</span><span class="cc-val muted">—</span></div>';
    }
    const display = isMail
      ? '<a class="cc-val cc-link" href="mailto:' + App.esc(value) + '">' + App.esc(value) + '</a>'
      : '<span class="cc-val">' + App.esc(value) + '</span>';
    const copy = '<button class="copy-btn" type="button" title="Copia" data-copy="' + App.esc(copyValue) + '">' + svg('copy') + '</button>';
    return '<div class="cc-row"><span class="cc-ic">' + svg(icon) + '</span>' + display + copy + '</div>';
  }

  function cardHtml(c) {
    const n = c.num_locali || 0;
    return '' +
      '<div class="client-card" data-id="' + c.id + '">' +
        '<div class="cc-head">' +
          '<input type="checkbox" class="cc-check" title="Seleziona">' +
          '<div class="cc-avatar">' + App.esc(App.initials(c.ragione_sociale)) + '</div>' +
          '<div class="cc-head-text">' +
            '<div class="cc-name">' + App.esc(c.ragione_sociale) + '</div>' +
            '<div class="cc-status">' + statoBadge(c.stato) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="cc-body">' +
          bodyRow('card', c.partita_iva, c.partita_iva, false) +
          bodyRow('phone', c.telefono, c.telefono, false) +
          bodyRow('mail', c.email, c.email, true) +
        '</div>' +
        '<div class="cc-foot">' +
          '<div class="cc-count">' + svg('building') + n + ' local' + (n === 1 ? 'e' : 'i') + '</div>' +
          '<div class="cc-tools">' +
            '<button class="icon-btn js-open" type="button" title="Apri locali" data-id="' + c.id + '">' + svg('open') + '</button>' +
            '<button class="icon-btn js-edit" type="button" title="Modifica" data-id="' + c.id + '">' + svg('pencil') + '</button>' +
            '<button class="icon-btn js-arch" type="button" title="Archivia" data-id="' + c.id + '">' + svg('archive') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---------- Aggiornamento card in place ---------- */
  function refreshCard(id) {
    App.apiGet('/api/clienti.php?action=get', { id: id }).done(function (res) {
      const c = res.cliente;
      c.num_locali = (c.locali || []).length;
      const $old = $('.client-card[data-id="' + id + '"]');
      const filter = $('#chips .chip.active').data('stato') || '';
      if (filter && filter !== c.stato) {
        $old.fadeOut(180, function () { $(this).remove(); setCount($('#list .client-card').length); });
        return;
      }
      if ($old.length) { $old.replaceWith(cardHtml(c)); } else { load(); }
    });
  }

  /* ---------- Eventi (delega) ---------- */
  $(document).on('click', '#list .copy-btn', function () {
    const v = $(this).attr('data-copy');
    App.copy(v).then(function () { App.ok('Copiato: ' + v); }).catch(function () { App.err('Copia non riuscita'); });
  });
  $(document).on('change', '#list .cc-check', function () {
    const $card = $(this).closest('.client-card');
    const id = $card.data('id');
    $card.toggleClass('selected', this.checked);
    if (this.checked) { selected.add(id); } else { selected.delete(id); }
    updateBulkBar();
  });
  $(document).on('click', '#list .js-open', function () { location.hash = '#/locali/' + $(this).data('id'); });
  // Click sulla card (escludendo checkbox/bottoni/link) -> profilo completo del cliente.
  $(document).on('click', '#list .client-card', function (e) {
    if ($(e.target).closest('button, a, input, label, .cc-tools, .cc-check, .copy-btn').length) return;
    location.hash = '#/locali/' + $(this).data('id');
  });
  $(document).on('click', '#list .js-edit', function () {
    location.hash = '#/clienti-form/' + $(this).data('id');
  });
  $(document).on('click', '#list .js-arch', function () {
    const id = $(this).data('id');
    App.confirm('Archivia cliente', 'Vuoi archiviare questo cliente? Potrai riattivarlo dalla modifica.', function () {
      App.apiPost('/api/clienti.php?action=archive&id=' + id).done(function () { App.ok('Cliente archiviato'); refreshCard(id); })
        .fail(function (xhr) { App.err(App.errMsg(xhr)); });
    }, 'Archivia');
  });

  App.views['clienti'] = { render: render, reload: load };
})(jQuery);
