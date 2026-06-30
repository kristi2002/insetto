/* documenti.js — preventivi e fatture (SDI). */
(function ($) {
  'use strict';
  App.views = App.views || {};
  let clienti = [];

  function statoBadge(s) {
    const map = { bozza: 'gray', emesso: 'warn', inviato_sdi: 'green', pagato: 'green', annullato: 'red' };
    return '<span class="badge ' + (map[s] || 'gray') + '">' + App.esc(s) + '</span>';
  }

  function render($view) {
    $view.html(
      '<div class="page-head"><div><h1>Fatturazione</h1><div class="sub">Preventivi e fatture elettroniche (SDI)</div></div>' +
        '<button class="btn primary" id="btnNewDoc">+ Nuovo documento</button></div>' +
      '<div class="toolbar"><select class="select" id="fTipo" style="max-width:200px">' +
        '<option value="">Tutti</option><option value="preventivo">Preventivi</option><option value="fattura">Fatture</option></select></div>' +
      '<div id="docList">' + App.loadingHtml + '</div>'
    );
    App.apiGet('/api/clienti.php?action=list').done(function (r) { clienti = r.clienti || []; });
    $view.find('#btnNewDoc').on('click', function () { openForm(null); });
    $view.find('#fTipo').on('change', load);
    load();
  }

  function load() {
    App.apiGet('/api/documenti.php?action=list', { tipo: $('#fTipo').val() || '' }).done(function (res) {
      const items = res.documenti || [];
      const $l = $('#docList');
      if (!items.length) { $l.html(App.emptyHtml('Nessun documento.', '🧾')); return; }
      $l.html('<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>Numero</th><th>Tipo</th><th>Data</th><th>Cliente</th><th>Imponibile</th><th>IVA</th><th>Totale</th><th>Stato</th><th></th></tr></thead><tbody>' +
        items.map(function (d) {
          const xmlBtn = d.tipo === 'fattura'
            ? '<a class="btn small" target="_blank" href="' + App.base + '/api/documenti.php?action=download_xml&id=' + d.id + '">XML</a> ' : '';
          return '<tr>' +
            '<td><strong>' + App.esc(d.numero || '—') + '</strong></td>' +
            '<td>' + App.esc(d.tipo) + '</td>' +
            '<td>' + App.esc(d.data) + '</td>' +
            '<td>' + App.esc(d.cliente_nome) + '</td>' +
            '<td>€ ' + (+d.imponibile).toFixed(2) + '</td>' +
            '<td>€ ' + (+d.iva).toFixed(2) + '</td>' +
            '<td><strong>€ ' + (+d.totale).toFixed(2) + '</strong></td>' +
            '<td>' + statoBadge(d.stato) + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn small js-edit" data-id="' + d.id + '">Apri</button> ' + xmlBtn +
              '<button class="btn small danger js-del" data-id="' + d.id + '">✕</button></td></tr>';
        }).join('') + '</tbody></table></div>');
    });
  }

  $(document).on('click', '#docList .js-edit', function () {
    App.apiGet('/api/documenti.php?action=get', { id: $(this).data('id') }).done(function (r) { openForm(r.documento); });
  });
  $(document).on('click', '#docList .js-del', function () {
    const id = $(this).data('id');
    App.confirm('Elimina documento', 'Eliminare questo documento?', function () {
      App.apiPost('/api/documenti.php?action=delete&id=' + id).done(function () { App.ok('Eliminato'); load(); })
        .fail(function (xhr) { App.err(App.errMsg(xhr)); });
    }, 'Elimina');
  });

  function rigaRow(r) {
    r = r || { descrizione: '', quantita: 1, prezzo_unitario: 0, aliquota_iva: 22 };
    return '<tr class="riga">' +
      '<td><input class="input r-desc" value="' + App.esc(r.descrizione) + '" placeholder="Descrizione"></td>' +
      '<td style="width:80px"><input class="input r-qta" type="number" step="0.01" value="' + r.quantita + '"></td>' +
      '<td style="width:100px"><input class="input r-prezzo" type="number" step="0.01" value="' + r.prezzo_unitario + '"></td>' +
      '<td style="width:70px"><input class="input r-iva" type="number" step="0.01" value="' + r.aliquota_iva + '"></td>' +
      '<td><button class="btn small danger js-rmriga" type="button">✕</button></td></tr>';
  }

  function openForm(doc) {
    const isEdit = !!doc; doc = doc || {};
    const cliOpts = clienti.map(function (c) { return '<option value="' + c.id + '"' + (doc.cliente_id == c.id ? ' selected' : '') + '>' + App.esc(c.ragione_sociale) + '</option>'; }).join('');
    const righe = (doc.righe && doc.righe.length) ? doc.righe : [null];
    const body =
      '<div class="form-row">' +
        '<div class="field"><label>Tipo</label><select class="select" id="d_tipo"' + (isEdit ? ' disabled' : '') + '>' +
          '<option value="preventivo"' + (doc.tipo === 'preventivo' ? ' selected' : '') + '>Preventivo</option>' +
          '<option value="fattura"' + (doc.tipo === 'fattura' ? ' selected' : '') + '>Fattura</option></select></div>' +
        '<div class="field"><label>Data</label><input class="input" type="date" id="d_data" value="' + App.esc(doc.data || '') + '"></div>' +
      '</div>' +
      '<div class="field"><label>Cliente *</label><select class="select" id="d_cli"' + (isEdit ? ' disabled' : '') + '><option value="">Seleziona…</option>' + cliOpts + '</select></div>' +
      '<label style="font-weight:600;font-size:.85rem">Righe</label>' +
      '<table class="data" style="width:100%;margin-bottom:8px"><thead><tr><th>Descrizione</th><th>Qtà</th><th>Prezzo</th><th>IVA%</th><th></th></tr></thead>' +
        '<tbody id="righeBody">' + righe.map(rigaRow).join('') + '</tbody></table>' +
      '<button class="btn small" type="button" id="addRiga">+ Riga</button>' +
      '<div class="field" style="margin-top:12px"><label>Note</label><textarea class="textarea" id="d_note">' + App.esc(doc.note) + '</textarea></div>' +
      (isEdit && doc.tipo === 'fattura' ? '<div style="margin-top:8px"><button class="btn" type="button" id="genXml">Genera XML SDI</button></div>' : '');

    const m = App.modal({
      title: isEdit ? ('Documento ' + (doc.numero || '')) : 'Nuovo documento',
      bodyHtml: body, okText: isEdit ? 'Salva' : 'Crea',
      onOk: function (close, $bd) {
        const righe = [];
        $bd.find('.riga').each(function () {
          const desc = $(this).find('.r-desc').val().trim();
          if (!desc) return;
          righe.push({ descrizione: desc, quantita: $(this).find('.r-qta').val(), prezzo_unitario: $(this).find('.r-prezzo').val(), aliquota_iva: $(this).find('.r-iva').val() });
        });
        const payload = { tipo: $bd.find('#d_tipo').val(), cliente_id: $bd.find('#d_cli').val(), data: $bd.find('#d_data').val(), note: $bd.find('#d_note').val().trim(), righe: righe };
        if (!isEdit && !payload.cliente_id) { App.err('Cliente obbligatorio'); return; }
        const req = isEdit ? App.apiPut('/api/documenti.php?action=update&id=' + doc.id, payload)
                           : App.apiPost('/api/documenti.php?action=create', payload);
        req.done(function () { close(); App.ok('Salvato'); load(); }).fail(function (xhr) { App.err(App.errMsg(xhr)); });
      },
    });

    m.el.on('click', '#addRiga', function () { m.el.find('#righeBody').append(rigaRow(null)); });
    m.el.on('click', '.js-rmriga', function () { $(this).closest('tr').remove(); });
    m.el.on('click', '#genXml', function () {
      App.apiPost('/api/documenti.php?action=genera_xml', { id: doc.id }).done(function () {
        App.ok('XML generato'); window.open(App.base + '/api/documenti.php?action=download_xml&id=' + doc.id, '_blank');
      }).fail(function (xhr) { App.err(App.errMsg(xhr)); });
    });
  }

  App.views['documenti'] = { render: render };
})(jQuery);
