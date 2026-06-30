/* portale.js — portale cliente (sola lettura). */
(function ($) {
  'use strict';
  const $view = $('#view');
  $('#logoutBtn').on('click', function () { App.logout(); });

  function statoBadge(s) {
    const cls = s === 'inviato' ? 'green' : 'warn';
    return '<span class="badge ' + cls + '">' + App.esc(s) + '</span>';
  }

  App.loadSession().done(function () { home(); });

  function home() {
    $view.html(App.loadingHtml);
    App.apiGet('/api/portale.php?action=overview').done(function (res) {
      const c = res.cliente || {};
      let html =
        '<div class="page-head"><div><h1>' + App.esc(c.ragione_sociale) + '</h1>' +
          '<div class="sub">' + (c.partita_iva ? 'P.IVA ' + App.esc(c.partita_iva) : '') + '</div></div></div>';

      // Locali
      html += '<div class="section-title">I tuoi locali</div>';
      const locali = res.locali || [];
      if (!locali.length) { html += App.emptyHtml('Nessun locale registrato.', '🏬'); }
      else {
        html += '<div class="grid">' + locali.map(function (l) {
          return '<div class="card clickable js-loc" data-id="' + l.id + '" data-nome="' + App.esc(l.nome) + '">' +
            '<div class="card-top"><div class="avatar blue">' + App.esc(App.initials(l.nome)) + '</div>' +
            '<div><div class="title">' + App.esc(l.nome) + '</div><div class="meta">' + App.esc(l.indirizzo || '') + '</div></div></div>' +
            '<div class="row"><span class="k">Postazioni</span><span>' + (l.num_postazioni || 0) + '</span></div>' +
            (l.frequenza_servizio ? '<div class="row"><span class="k">Frequenza</span><span>' + App.esc(l.frequenza_servizio) + '</span></div>' : '') +
            '<div class="card-actions"><button class="btn small primary js-loc" data-id="' + l.id + '" data-nome="' + App.esc(l.nome) + '">Vedi postazioni</button></div>' +
          '</div>';
        }).join('') + '</div>';
      }

      // Interventi / report
      html += '<div class="section-title">Storico interventi e report</div>';
      const items = res.interventi || [];
      if (!items.length) { html += App.emptyHtml('Nessun intervento disponibile.', '🗓️'); }
      else {
        html += '<div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>Data</th><th>Locale</th><th>Tecnico</th><th>Tipologia</th><th>Stato</th><th>Report</th>' +
          '</tr></thead><tbody>' +
          items.map(function (i) {
            return '<tr>' +
              '<td>' + App.esc(i.data) + '</td>' +
              '<td>' + App.esc(i.locale_nome) + '</td>' +
              '<td>' + App.esc(i.tecnico_nome) + '</td>' +
              '<td>' + App.esc(i.tipologia) + '</td>' +
              '<td>' + statoBadge(i.stato) + '</td>' +
              '<td><a class="btn small primary" target="_blank" href="' + App.base + '/api/report.php?action=download&intervento_id=' + i.id + '">Scarica PDF</a></td>' +
            '</tr>';
          }).join('') +
          '</tbody></table></div>';
      }

      $view.html(html);
    }).fail(function (xhr) { $view.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  $view.on('click', '.js-loc', function (e) {
    e.stopPropagation();
    showPostazioni($(this).data('id'), $(this).data('nome'));
  });

  function showPostazioni(localeId, nome) {
    App.apiGet('/api/portale.php?action=postazioni', { locale_id: localeId }).done(function (res) {
      const ps = res.postazioni || [];
      let body;
      if (!ps.length) { body = '<p class="muted">Nessuna postazione attiva.</p>'; }
      else {
        body = '<div class="table-wrap"><table class="data"><thead><tr><th>N°</th><th>Area</th><th>Ubicazione</th><th>Dispositivo</th><th>Rischio</th></tr></thead><tbody>' +
          ps.map(function (p) {
            return '<tr><td>' + p.numero + '</td><td>' + App.esc(p.area_nome) + ' (' + p.area_tipo + ')</td><td>' +
              App.esc(p.ubicazione || '') + '</td><td>' + App.esc(p.tipo_nome) + '</td><td>' + App.esc(p.grado_rischio) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      App.modal({ title: 'Postazioni · ' + nome, bodyHtml: body, hideOk: true, cancelText: 'Chiudi', okText: '' });
    }).fail(function (xhr) { App.err(App.errMsg(xhr)); });
  }
})(jQuery);
