/* utenti.js — gestione utenti e ruoli (admin). Route: #/utenti */
(function ($) {
  'use strict';
  App.views = App.views || {};
  let clientiCache = [];

  function ruoloBadge(r) {
    const cls = r === 'admin' ? 'green' : (r === 'tecnico' ? 'warn' : 'gray');
    return '<span class="badge ' + cls + '">' + App.esc(r) + '</span>';
  }

  function render($view) {
    $view.html(
      '<div class="page-head">' +
        '<div><h1>Utenti</h1><div class="sub">Account e ruoli (admin, tecnico, cliente)</div></div>' +
        '<button class="btn primary" id="btnNewU">+ Nuovo utente</button>' +
      '</div>' +
      '<div class="toolbar"><select class="select" id="fRuolo" style="max-width:200px">' +
        '<option value="">Tutti i ruoli</option><option>admin</option><option>tecnico</option><option>cliente</option>' +
      '</select></div>' +
      '<div id="uList">' + App.loadingHtml + '</div>'
    );
    $view.find('#btnNewU').on('click', function () { location.hash = '#/utenti-form'; });
    $view.find('#fRuolo').on('change', load);
    load();
  }

  function load() {
    App.apiGet('/api/users.php?action=list', { ruolo: $('#fRuolo').val() || '' }).done(function (res) {
      const users = res.users || [];
      const $l = $('#uList');
      if (!users.length) { $l.html(App.emptyHtml('Nessun utente.', '👤')); return; }
      $l.html(
        '<div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>Nome</th><th>Email</th><th>Ruolo</th><th>Cliente</th><th>Stato</th><th></th>' +
        '</tr></thead><tbody>' +
        users.map(function (u) {
          return '<tr>' +
            '<td><strong>' + App.esc(u.nome) + '</strong></td>' +
            '<td>' + App.esc(u.email) + '</td>' +
            '<td>' + ruoloBadge(u.ruolo) + '</td>' +
            '<td>' + App.esc(u.cliente_nome || '—') + '</td>' +
            '<td>' + (u.attivo == 1 ? '<span class="badge green">attivo</span>' : '<span class="badge gray">disattivo</span>') + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn small js-edit" data-id="' + u.id + '" data-u="' + encodeURIComponent(JSON.stringify(u)) + '">Modifica</button> ' +
              '<button class="btn small js-tog" data-id="' + u.id + '">' + (u.attivo == 1 ? 'Disattiva' : 'Attiva') + '</button> ' +
              '<button class="btn small danger js-del" data-id="' + u.id + '">Elimina</button>' +
            '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>'
      );
    });
  }

  $(document).on('click', '#uList .js-edit', function () {
    location.hash = '#/utenti-form/' + $(this).data('id');
  });
  $(document).on('click', '#uList .js-tog', function () {
    App.apiPost('/api/users.php?action=toggle&id=' + $(this).data('id')).done(function () { load(); })
      .fail(function (xhr) { App.err(App.errMsg(xhr)); });
  });
  $(document).on('click', '#uList .js-del', function () {
    const id = $(this).data('id');
    App.confirm('Elimina utente', 'Eliminare questo utente?', function () {
      App.apiPost('/api/users.php?action=delete&id=' + id).done(function () { App.ok('Eliminato'); load(); })
        .fail(function (xhr) { App.err(App.errMsg(xhr)); });
    }, 'Elimina');
  });

  App.views['utenti'] = { render: render };
})(jQuery);
