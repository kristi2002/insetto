/* interventi.js — pianificazione e lista interventi (admin).
   Route: #/interventi  e  #/intervento/:id (dettaglio). */
(function ($) {
  'use strict';
  App.views = App.views || {};

  const TIPOLOGIE = ['programmato', 'straordinario', 'primo_impianto', 'sopralluogo'];

  function statoBadge(s) {
    const cls = s === 'inviato' ? 'green' : (s === 'validato' ? 'warn' : 'gray');
    return '<span class="badge ' + cls + '">' + App.esc(s) + '</span>';
  }

  /* ===================== LISTA (griglia di schede paginata) ===================== */
  const PAGE_SIZE = 18;          // schede per pagina
  let allItems = [];             // tutti gli interventi caricati
  let curPage = 1;               // pagina corrente

  function render($view) {
    $view.html(
      '<div class="page-head">' +
        '<div><h1>Interventi</h1><div class="sub">Pianificazione e storico</div></div>' +
        '<button class="btn primary" id="btnNewInt">+ Nuovo intervento</button>' +
      '</div>' +
      '<div class="toolbar">' +
        '<select class="select" id="fStato" style="max-width:180px">' +
          '<option value="">Tutti gli stati</option><option>bozza</option><option>validato</option><option>inviato</option>' +
        '</select>' +
        '<input class="input" type="date" id="fFrom" style="max-width:170px">' +
        '<input class="input" type="date" id="fTo" style="max-width:170px">' +
      '</div>' +
      '<div id="intList">' + App.loadingHtml + '</div>'
    );
    $view.find('#btnNewInt').on('click', function () { location.hash = '#/intervento-form'; });
    $view.find('#fStato,#fFrom,#fTo').on('change', function () { curPage = 1; load(); });
    load();
  }

  function load() {
    App.apiGet('/api/interventi.php?action=list', {
      stato: $('#fStato').val() || '', from: $('#fFrom').val() || '', to: $('#fTo').val() || '',
    }).done(function (res) {
      allItems = res.interventi || [];
      const $l = $('#intList');
      if (!allItems.length) { $l.html(App.emptyHtml('Nessun intervento.', '🗓️')); return; }
      // Contenitore scrollabile (le schede scorrono dentro) + paginazione.
      $l.html(
        '<div class="results-count" id="intCount"></div>' +
        '<div class="int-scroll"><div class="int-grid" id="intGrid"></div></div>' +
        '<div class="pager" id="intPager"></div>'
      );
      renderPage();
    }).fail(function (xhr) { $('#intList').html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  function tileHtml(i) {
    return '<div class="int-tile" data-id="' + i.id + '">' +
      '<div class="int-tile-top"><span class="int-date">' + App.esc(i.data) + '</span>' + statoBadge(i.stato) + '</div>' +
      '<div class="int-cli">' + App.esc(i.cliente_nome) + '</div>' +
      '<div class="int-meta">🏢 ' + App.esc(i.locale_nome) + '</div>' +
      '<div class="int-meta">👤 ' + App.esc(i.tecnico_nome) + '</div>' +
      '<div class="int-meta"><span class="badge gray">' + App.esc(i.tipologia) + '</span></div>' +
      '<div class="int-tile-foot">' +
        '<button class="btn small primary js-open" data-id="' + i.id + '">Apri</button>' +
        '<button class="btn small js-edit" data-id="' + i.id + '">Modifica</button>' +
        '<button class="btn small danger js-del" data-id="' + i.id + '">Elimina</button>' +
      '</div>' +
    '</div>';
  }

  function renderPage() {
    const total = allItems.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (curPage > pages) curPage = pages;
    const start = (curPage - 1) * PAGE_SIZE;
    const slice = allItems.slice(start, start + PAGE_SIZE);

    $('#intGrid').html(slice.map(tileHtml).join(''));
    $('.int-scroll').scrollTop(0);
    $('#intCount').text(total + ' intervent' + (total === 1 ? 'o' : 'i') +
      (pages > 1 ? ' · pagina ' + curPage + ' di ' + pages : ''));
    $('#intPager').html(pages > 1 ? pagerHtml(curPage, pages) : '');
  }

  // Paginazione con finestra di pagine attorno alla corrente.
  function pagerHtml(page, pages) {
    function btn(label, p, opts) {
      opts = opts || {};
      return '<button class="pg' + (opts.active ? ' active' : '') + '"' +
        (opts.disabled ? ' disabled' : ' data-page="' + p + '"') + '>' + label + '</button>';
    }
    let html = btn('‹', page - 1, { disabled: page <= 1 });
    const win = 2;
    let from = Math.max(1, page - win), to = Math.min(pages, page + win);
    if (from > 1) { html += btn('1', 1, {}); if (from > 2) html += '<span class="pg-info">…</span>'; }
    for (let p = from; p <= to; p++) html += btn(String(p), p, { active: p === page });
    if (to < pages) { if (to < pages - 1) html += '<span class="pg-info">…</span>'; html += btn(String(pages), pages, {}); }
    html += btn('›', page + 1, { disabled: page >= pages });
    return html;
  }

  $(document).on('click', '#intPager .pg[data-page]', function () {
    curPage = parseInt($(this).data('page'), 10) || 1;
    renderPage();
  });

  $(document).on('click', '#intList .js-open', function () { location.hash = '#/intervento/' + $(this).data('id'); });
  $(document).on('click', '#intList .js-edit', function () { location.hash = '#/intervento-form/' + $(this).data('id'); });
  $(document).on('click', '#intList .js-del', function () {
    const id = $(this).data('id');
    App.confirm('Elimina intervento', 'Eliminare questo intervento e tutte le sue rilevazioni?', function () {
      App.apiPost('/api/interventi.php?action=delete&id=' + id).done(function () { App.ok('Eliminato'); load(); })
        .fail(function (xhr) { App.err(App.errMsg(xhr)); });
    }, 'Elimina');
  });

  App.views['interventi'] = { render: render };

  /* ===================== DETTAGLIO (read + report) ===================== */
  function renderDetail($view, arg) {
    const id = parseInt(arg, 10);
    $view.html(App.loadingHtml);
    App.apiGet('/api/interventi.php?action=get', { id: id }).done(function (res) {
      const i = res.intervento;
      let html =
        '<div class="sub" style="margin-bottom:8px"><a href="#/interventi">← Interventi</a></div>' +
        '<div class="page-head"><div><h1>' + App.esc(i.cliente_nome) + '</h1>' +
          '<div class="sub">' + App.esc(i.locale_nome) + ' · ' + App.esc(i.data) + ' · ' + App.esc(i.tecnico_nome) + ' ' + statoBadge(i.stato) + '</div></div>' +
          '<div>' +
            '<a class="btn" target="_blank" href="' + App.base + '/api/report.php?action=download&intervento_id=' + i.id + '">Scarica PDF</a> ' +
            '<button class="btn primary" id="btnGen">Genera / Invia report</button>' +
          '</div>' +
        '</div>';

      // Soglie
      html += '<div class="card" style="margin-bottom:16px"><h3 style="margin-top:0">Esito soglie</h3>';
      (i.soglie || []).forEach(function (g) {
        const sup = g.esito === 'superato';
        html += '<div class="row" style="justify-content:space-between;align-items:center">' +
          '<span>' + App.esc(g.area_nome) + ' · ' + App.esc(g.tipo_nome) + ' <span class="muted">(' + g.con_attivita + '/' + g.totale + ', limite ' + g.limite + ')</span></span>' +
          '<span class="badge ' + (sup ? 'red' : 'green') + '">' + (sup ? 'superato' : 'non superato') + '</span></div>';
      });
      if (!(i.soglie || []).length) html += '<div class="muted">Nessun dato.</div>';
      html += '</div>';

      // Postazioni rilevate
      html += '<div class="table-wrap"><table class="data stack"><thead><tr><th>N°</th><th>Area</th><th>Ubicazione</th><th>Dispositivo</th><th>Rischio</th><th>Rilevazione</th><th>Stato</th></tr></thead><tbody>';
      i.postazioni.forEach(function (p) {
        const ril = (p.catture != null || p.consumo_esca_pct != null)
          ? (p.metrica === 'consumo' ? ('consumo ' + (p.consumo_esca_pct || 0) + '%') : ('catture ' + (p.catture || 0)))
          : '<span class="muted">—</span>';
        const gcls = p.grado_rischio === 'alto' ? 'red' : (p.grado_rischio === 'medio' ? 'warn' : 'gray');
        html += '<tr><td data-label="N°">' + p.numero + '</td><td data-label="Area">' + App.esc(p.area_nome) + '</td><td data-label="Ubicazione">' + App.esc(p.ubicazione || '') +
          '</td><td data-label="Dispositivo">' + App.esc(p.tipo_nome) + '</td><td data-label="Rischio"><span class="badge ' + gcls + '">' + App.esc(p.grado_rischio || '—') + '</span></td><td data-label="Rilevazione">' + ril + '</td><td data-label="Stato">' + App.esc(p.stato_trappola || '') + '</td></tr>';
      });
      html += '</tbody></table></div>';

      $view.html(html);
      $view.find('#btnGen').on('click', function () { genReport(i.id); });
    }).fail(function (xhr) { $view.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  function genReport(id) {
    App.apiPost('/api/report.php?action=generate', { intervento_id: id }).done(function () {
      App.modal({
        title: 'Report pronto',
        bodyHtml: '<p>PDF generato.</p><p><a class="btn primary" target="_blank" href="' + App.base + '/api/report.php?action=download&intervento_id=' + id + '">Apri PDF</a></p>',
        okText: 'Invia email al cliente',
        onOk: function (close) {
          App.apiPost('/api/report.php?action=send', { intervento_id: id }).done(function () { close(); App.ok('Inviato'); })
            .fail(function (xhr) { App.err(App.errMsg(xhr)); });
        },
      });
    }).fail(function (xhr) { App.err(App.errMsg(xhr)); });
  }

  App.views['intervento'] = { render: renderDetail };
})(jQuery);
