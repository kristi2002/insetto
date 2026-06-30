/* haccp.js — registro IPM/HACCP: superamenti soglia per intervento. */
(function ($) {
  'use strict';
  App.views = App.views || {};

  function render($view) {
    $view.html(
      '<div class="page-head"><div><h1>Registro HACCP / IPM</h1><div class="sub">Esiti soglie e superamenti</div></div></div>' +
      '<div id="haccpSummary"></div>' +
      '<div class="toolbar">' +
        '<select class="select" id="fEsito" style="max-width:220px">' +
          '<option value="">Tutti gli esiti</option><option value="superato">Solo superati</option><option value="non_superato">Solo non superati</option></select>' +
        '<input class="input" type="date" id="fFrom" style="max-width:170px">' +
        '<input class="input" type="date" id="fTo" style="max-width:170px">' +
      '</div>' +
      '<div id="haccpList">' + App.loadingHtml + '</div>'
    );
    $view.find('#fEsito,#fFrom,#fTo').on('change', load);
    App.apiGet('/api/haccp.php?action=summary').done(function (s) {
      $('#haccpSummary').html('<div class="stat-grid">' +
        '<div class="stat"><div class="stat-val">' + s.totale + '</div><div class="stat-lbl">Righe registro</div></div>' +
        '<div class="stat danger"><div class="stat-val">' + s.superati + '</div><div class="stat-lbl">Superamenti</div></div>' +
        '<div class="stat ok"><div class="stat-val">' + s.non_superati + '</div><div class="stat-lbl">Nei limiti</div></div></div>');
    });
    load();
  }

  function load() {
    App.apiGet('/api/haccp.php?action=registro', {
      esito: $('#fEsito').val() || '', from: $('#fFrom').val() || '', to: $('#fTo').val() || '',
    }).done(function (res) {
      const rows = res.registro || [];
      const $l = $('#haccpList');
      if (!rows.length) { $l.html(App.emptyHtml('Nessuna registrazione.', '📋')); return; }
      $l.html('<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>Data</th><th>Cliente</th><th>Locale</th><th>Area</th><th>Dispositivo</th><th>Attività</th><th>Limite</th><th>Esito</th></tr></thead><tbody>' +
        rows.map(function (h) {
          const ko = h.esito === 'superato';
          return '<tr>' +
            '<td>' + App.esc(h.data) + '</td><td>' + App.esc(h.cliente_nome) + '</td><td>' + App.esc(h.locale_nome) + '</td>' +
            '<td>' + App.esc(h.area_nome || '—') + '</td><td>' + App.esc(h.tipo_nome || '—') + '</td>' +
            '<td>' + h.con_attivita + '/' + h.totale_postazioni + '</td><td>≤ ' + h.limite + '</td>' +
            '<td><span class="badge ' + (ko ? 'red' : 'green') + '">' + (ko ? 'superato' : 'non superato') + '</span></td></tr>';
        }).join('') + '</tbody></table></div>');
    }).fail(function (xhr) { $('#haccpList').html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  App.views['haccp'] = { render: render };
})(jQuery);
