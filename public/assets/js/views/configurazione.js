/* configurazione.js — tipi dispositivo + soglie (admin). Route: #/configurazione */
(function ($) {
  'use strict';
  App.views = App.views || {};

  function render($view) {
    $view.html(
      '<div class="page-head">' +
        '<div><h1>Configurazione</h1><div class="sub">Tipi di dispositivo e soglie di attività</div></div>' +
        '<button class="btn primary" id="btnNewTipo">+ Nuovo tipo</button>' +
      '</div>' +
      '<div id="tipiList">' + App.loadingHtml + '</div>'
    );
    $view.find('#btnNewTipo').on('click', function () { location.hash = '#/tipo-form'; });
    load();
  }

  function load() {
    App.apiGet('/api/tipi_dispositivo.php?action=list').done(function (res) {
      const tipi = res.tipi || [];
      const $l = $('#tipiList');
      if (!tipi.length) { $l.html(App.emptyHtml('Nessun tipo dispositivo.', '⚙️')); return; }
      $l.html(
        '<div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>Nome</th><th>Metrica</th><th>Limite soglia</th><th></th>' +
        '</tr></thead><tbody>' +
        tipi.map(function (t) {
          return '<tr>' +
            '<td><strong>' + App.esc(t.nome) + '</strong></td>' +
            '<td><span class="badge gray">' + App.esc(t.metrica) + '</span></td>' +
            '<td>≤ ' + t.limite + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn small js-edit" data-id="' + t.id + '" data-nome="' + App.esc(t.nome) + '" data-metrica="' + t.metrica + '" data-limite="' + t.limite + '">Modifica</button> ' +
              '<button class="btn small danger js-del" data-id="' + t.id + '">Elimina</button>' +
            '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>'
      );
    });
  }

  $(document).on('click', '#tipiList .js-edit', function () {
    location.hash = '#/tipo-form/' + $(this).data('id');
  });
  $(document).on('click', '#tipiList .js-del', function () {
    const id = $(this).data('id');
    App.confirm('Elimina tipo', 'Eliminare questo tipo dispositivo? (Bloccato se in uso da postazioni).', function () {
      App.apiPost('/api/tipi_dispositivo.php?action=delete&id=' + id).done(function () { App.ok('Eliminato'); load(); })
        .fail(function (xhr) { App.err(App.errMsg(xhr)); });
    }, 'Elimina');
  });

  App.views['configurazione'] = { render: render };
})(jQuery);
