/* magazzino.js — inventario: articoli, giacenze, lotti, alert riordino/scadenza. */
(function ($) {
  'use strict';
  App.views = App.views || {};
  const TIPI = ['esca', 'trappola', 'prodotto', 'presidio'];

  function render($view) {
    $view.html(
      '<div class="page-head"><div><h1>Magazzino</h1><div class="sub">Articoli, lotti, scadenze e riordino</div></div>' +
        '<button class="btn primary" id="btnNewArt">+ Nuovo articolo</button></div>' +
      '<div id="alertsBox"></div>' +
      '<div id="artList">' + App.loadingHtml + '</div>'
    );
    $view.find('#btnNewArt').on('click', function () { openArt(null); });
    loadAlerts();
    load();
  }

  function loadAlerts() {
    App.apiGet('/api/magazzino.php?action=alerts').done(function (a) {
      const r = a.riordino || [], s = a.scadenza || [];
      if (!r.length && !s.length) { $('#alertsBox').html(''); return; }
      let h = '';
      if (r.length) h += '<div class="card" style="border-left:4px solid var(--warn);margin-bottom:12px"><strong>⚠️ Da riordinare (' + r.length + ')</strong>: ' +
        r.map(function (x) { return App.esc(x.nome) + ' <span class="muted">(' + x.giacenza + '/' + x.soglia_riordino + ' ' + App.esc(x.unita) + ')</span>'; }).join(' · ') + '</div>';
      if (s.length) h += '<div class="card" style="border-left:4px solid var(--danger);margin-bottom:12px"><strong>⏰ In scadenza (' + s.length + ')</strong>: ' +
        s.map(function (x) { return App.esc(x.articolo_nome) + ' lotto ' + App.esc(x.codice_lotto) + ' <span class="muted">(' + x.scadenza + ', ' + x.giorni_alla_scadenza + 'gg)</span>'; }).join(' · ') + '</div>';
      $('#alertsBox').html(h);
    });
  }

  function load() {
    App.apiGet('/api/magazzino.php?action=articoli_list').done(function (res) {
      const items = res.articoli || [];
      const $l = $('#artList');
      if (!items.length) { $l.html(App.emptyHtml('Nessun articolo a magazzino.', '📦')); return; }
      $l.html('<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>Articolo</th><th>Tipo</th><th>Giacenza</th><th>Soglia</th><th>Prezzo</th><th></th></tr></thead><tbody>' +
        items.map(function (a) {
          return '<tr>' +
            '<td><strong>' + App.esc(a.nome) + '</strong>' + (a.codice ? ' <span class="muted">' + App.esc(a.codice) + '</span>' : '') + '</td>' +
            '<td><span class="badge gray">' + App.esc(a.tipo) + '</span></td>' +
            '<td>' + (a.sotto_soglia ? '<span class="badge red">' + a.giacenza + ' ' + App.esc(a.unita) + '</span>' : a.giacenza + ' ' + App.esc(a.unita)) + '</td>' +
            '<td>' + a.soglia_riordino + '</td>' +
            '<td>€ ' + (+a.prezzo_unitario).toFixed(2) + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn small js-lotti" data-id="' + a.id + '" data-nome="' + App.esc(a.nome) + '">Lotti</button> ' +
              '<button class="btn small js-edit" data-id="' + a.id + '" data-a="' + encodeURIComponent(JSON.stringify(a)) + '">Modifica</button> ' +
              '<button class="btn small danger js-del" data-id="' + a.id + '">✕</button>' +
            '</td></tr>';
        }).join('') + '</tbody></table></div>');
    });
  }

  $(document).on('click', '#artList .js-edit', function () { openArt(JSON.parse(decodeURIComponent($(this).attr('data-a')))); });
  $(document).on('click', '#artList .js-del', function () {
    const id = $(this).data('id');
    App.confirm('Elimina articolo', 'Eliminare l\'articolo e i suoi lotti?', function () {
      App.apiPost('/api/magazzino.php?action=articolo_delete&id=' + id).done(function () { App.ok('Eliminato'); load(); loadAlerts(); })
        .fail(function (xhr) { App.err(App.errMsg(xhr)); });
    }, 'Elimina');
  });
  $(document).on('click', '#artList .js-lotti', function () { openLotti($(this).data('id'), $(this).data('nome')); });

  function openArt(a) {
    const isEdit = !!a; a = a || {};
    const body =
      '<div class="field"><label>Nome *</label><input class="input" id="a_nome" value="' + App.esc(a.nome) + '"></div>' +
      '<div class="form-row">' +
        '<div class="field"><label>Tipo</label><select class="select" id="a_tipo">' +
          TIPI.map(function (t) { return '<option' + (a.tipo === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>Codice</label><input class="input" id="a_cod" value="' + App.esc(a.codice) + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="field"><label>Unità</label><input class="input" id="a_unita" value="' + App.esc(a.unita || 'pz') + '"></div>' +
        '<div class="field"><label>Prezzo unitario €</label><input class="input" type="number" step="0.01" id="a_prezzo" value="' + (a.prezzo_unitario != null ? a.prezzo_unitario : 0) + '"></div>' +
      '</div>' +
      '<div class="field"><label>Soglia riordino</label><input class="input" type="number" step="0.01" id="a_soglia" value="' + (a.soglia_riordino != null ? a.soglia_riordino : 0) + '"></div>' +
      (isEdit ? '<div class="field"><label><input type="checkbox" id="a_attivo"' + (a.attivo == 1 ? ' checked' : '') + '> Attivo</label></div>' : '');
    App.modal({
      title: isEdit ? 'Modifica articolo' : 'Nuovo articolo', bodyHtml: body, okText: isEdit ? 'Salva' : 'Crea',
      onOk: function (close, $bd) {
        const p = {
          id: a.id, nome: $bd.find('#a_nome').val().trim(), tipo: $bd.find('#a_tipo').val(),
          codice: $bd.find('#a_cod').val().trim(), unita: $bd.find('#a_unita').val().trim(),
          prezzo_unitario: $bd.find('#a_prezzo').val(), soglia_riordino: $bd.find('#a_soglia').val(),
          attivo: isEdit ? ($bd.find('#a_attivo').is(':checked') ? 1 : 0) : 1,
        };
        if (!p.nome) { App.err('Nome obbligatorio'); return; }
        App.apiPost('/api/magazzino.php?action=articolo_save', p).done(function () { close(); App.ok('Salvato'); load(); loadAlerts(); })
          .fail(function (xhr) { App.err(App.errMsg(xhr)); });
      },
    });
  }

  function openLotti(artId, nome) {
    const m = App.modal({
      title: 'Lotti · ' + nome,
      bodyHtml: '<div id="lottiBody">' + App.loadingHtml + '</div>',
      okText: '+ Nuovo lotto',
      cancelText: 'Chiudi',
      onOk: function (close, $bd) { lottoForm(artId, function () { refreshLotti(artId, $bd); }); },
    });
    refreshLotti(artId, m.el);
  }

  function refreshLotti(artId, $bd) {
    App.apiGet('/api/magazzino.php?action=lotti_list', { articolo_id: artId }).done(function (res) {
      const lotti = res.lotti || [];
      let h = lotti.length
        ? '<table class="data" style="width:100%"><thead><tr><th>Lotto</th><th>Scadenza</th><th>Residuo</th><th></th></tr></thead><tbody>' +
          lotti.map(function (l) {
            return '<tr><td>' + App.esc(l.codice_lotto) + '</td><td>' + App.esc(l.scadenza || '—') + '</td><td>' + l.quantita_residua + '/' + l.quantita_iniziale +
              '</td><td><button class="btn small danger js-dellotto" data-id="' + l.id + '">✕</button></td></tr>';
          }).join('') + '</tbody></table>'
        : '<div class="muted">Nessun lotto.</div>';
      $bd.find('#lottiBody').attr('data-art', artId).html(h);
    });
  }

  $(document).on('click', '#lottiBody .js-dellotto', function () {
    const id = $(this).data('id');
    const $bd = $(this).closest('.modal-backdrop');
    const artId = $(this).closest('#lottiBody').data('art');
    App.apiPost('/api/magazzino.php?action=lotto_delete&id=' + id).done(function () {
      App.ok('Lotto eliminato'); load(); loadAlerts();
      refreshLotti(artId, $bd);
    }).fail(function (xhr) { App.err(App.errMsg(xhr)); });
  });

  function lottoForm(artId, after) {
    App.modal({
      title: 'Nuovo lotto',
      bodyHtml:
        '<div class="field"><label>Codice lotto *</label><input class="input" id="l_cod"></div>' +
        '<div class="form-row">' +
          '<div class="field"><label>Scadenza</label><input class="input" type="date" id="l_scad"></div>' +
          '<div class="field"><label>Quantità iniziale</label><input class="input" type="number" step="0.01" id="l_qta" value="0"></div>' +
        '</div>',
      okText: 'Aggiungi',
      onOk: function (close, $bd) {
        const p = { articolo_id: artId, codice_lotto: $bd.find('#l_cod').val().trim(), scadenza: $bd.find('#l_scad').val() || null, quantita_iniziale: $bd.find('#l_qta').val() };
        if (!p.codice_lotto) { App.err('Codice lotto obbligatorio'); return; }
        App.apiPost('/api/magazzino.php?action=lotto_save', p).done(function () { close(); App.ok('Lotto aggiunto'); load(); loadAlerts(); if (after) after(); })
          .fail(function (xhr) { App.err(App.errMsg(xhr)); });
      },
    });
  }

  App.views['magazzino'] = { render: render };
})(jQuery);
