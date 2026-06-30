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

  /* ===================== LISTA ===================== */
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
    $view.find('#fStato,#fFrom,#fTo').on('change', load);
    load();
  }

  function load() {
    App.apiGet('/api/interventi.php?action=list', {
      stato: $('#fStato').val() || '', from: $('#fFrom').val() || '', to: $('#fTo').val() || '',
    }).done(function (res) {
      const items = res.interventi || [];
      const $l = $('#intList');
      if (!items.length) { $l.html(App.emptyHtml('Nessun intervento.', '🗓️')); return; }
      $l.html(
        '<div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>Data</th><th>Cliente</th><th>Locale</th><th>Tecnico</th><th>Tipologia</th><th>Stato</th><th></th>' +
        '</tr></thead><tbody>' +
        items.map(function (i) {
          return '<tr>' +
            '<td>' + App.esc(i.data) + '</td>' +
            '<td>' + App.esc(i.cliente_nome) + '</td>' +
            '<td>' + App.esc(i.locale_nome) + '</td>' +
            '<td>' + App.esc(i.tecnico_nome) + '</td>' +
            '<td>' + App.esc(i.tipologia) + '</td>' +
            '<td>' + statoBadge(i.stato) + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn small primary js-open" data-id="' + i.id + '">Apri</button> ' +
              '<button class="btn small js-edit" data-id="' + i.id + '">Modifica</button> ' +
              '<button class="btn small danger js-del" data-id="' + i.id + '">Elimina</button>' +
            '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>'
      );
    });
  }

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
      html += '<div class="table-wrap"><table class="data"><thead><tr><th>N°</th><th>Area</th><th>Ubicazione</th><th>Dispositivo</th><th>Rischio</th><th>Rilevazione</th><th>Stato</th></tr></thead><tbody>';
      i.postazioni.forEach(function (p) {
        const ril = (p.catture != null || p.consumo_esca_pct != null)
          ? (p.metrica === 'consumo' ? ('consumo ' + (p.consumo_esca_pct || 0) + '%') : ('catture ' + (p.catture || 0)))
          : '<span class="muted">—</span>';
        const gcls = p.grado_rischio === 'alto' ? 'red' : (p.grado_rischio === 'medio' ? 'warn' : 'gray');
        html += '<tr><td>' + p.numero + '</td><td>' + App.esc(p.area_nome) + '</td><td>' + App.esc(p.ubicazione || '') +
          '</td><td>' + App.esc(p.tipo_nome) + '</td><td><span class="badge ' + gcls + '">' + App.esc(p.grado_rischio || '—') + '</span></td><td>' + ril + '</td><td>' + App.esc(p.stato_trappola || '') + '</td></tr>';
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
