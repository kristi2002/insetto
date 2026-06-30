/* locale.js — gestione di un locale: aree + postazioni + QR.
   Route: #/locale/:localeId */
(function ($) {
  'use strict';
  App.views = App.views || {};

  let localeId = null;
  let locale = null;
  let tipi = [];
  let tecnici = [];
  let interventi = [];

  function render($view, arg) {
    localeId = parseInt(arg, 10);
    if (!localeId) { location.hash = '#/clienti'; return; }
    $view.html(App.loadingHtml);
    $.when(
      App.apiGet('/api/locali.php?action=get', { id: localeId }),
      App.apiGet('/api/tipi_dispositivo.php?action=list'),
      App.apiGet('/api/interventi.php?action=tecnici')
    ).done(function (locRes, tipiRes, tecRes) {
      locale = locRes[0].locale;
      tipi = tipiRes[0].tipi || [];
      tecnici = tecRes[0].tecnici || [];
      paint($view);
    }).fail(function (xhr) { $view.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  function paint($view) {
    $view.html(
      '<div class="sub" style="margin-bottom:8px">' +
        '<a href="#/locali/' + locale.cliente_id + '">← ' + App.esc(locale.cliente_nome) + '</a></div>' +
      '<div class="page-head">' +
        '<div><h1>' + App.esc(locale.nome) + '</h1>' +
          '<div class="sub">' + (locale.indirizzo ? App.esc(locale.indirizzo) : '') + '</div></div>' +
      '</div>' +
      // --- Sessioni / interventi (passati e futuri) ---
      '<div class="page-head" style="margin-top:4px">' +
        '<div class="section-title" style="margin:0">Interventi (sessioni)</div>' +
        '<button class="btn primary" id="btnNewInt">+ Nuovo intervento</button>' +
      '</div>' +
      '<div id="intBox">' + App.loadingHtml + '</div>' +
      // --- Aree e postazioni ---
      '<div class="page-head" style="margin-top:26px">' +
        '<div class="section-title" style="margin:0">Aree e postazioni</div>' +
        '<button class="btn" id="btnNewArea">+ Nuova area</button>' +
      '</div>' +
      '<div id="areeBox">' + App.loadingHtml + '</div>'
    );
    $view.find('#btnNewArea').on('click', function () {
      openSelectInterventoModal();
    });
    $view.find('#btnNewInt').on('click', function () {
      App.formPreset = { cliente_id: locale.cliente_id, locale_id: localeId };
      App.formReturn = '#/locale/' + localeId;
      location.hash = '#/intervento-form';
    });

    loadInterventi().always(function () {
      loadAree();
    });
  }

  /* ---------- Interventi: passati e futuri ---------- */
  function statoBadge(s) {
    const cls = s === 'inviato' ? 'green' : (s === 'validato' ? 'warn' : 'gray');
    return '<span class="badge ' + cls + '">' + App.esc(s) + '</span>';
  }

  function loadInterventi() {
    return App.apiGet('/api/interventi.php?action=list', { locale_id: localeId }).done(function (res) {
      interventi = res.interventi || [];
      const $box = $('#intBox');
      if (!interventi.length) { $box.html(App.emptyHtml('Nessun intervento per questo locale.', '🗓️')); return; }
      const today = new Date().toISOString().slice(0, 10);
      const futuri = interventi.filter(function (i) { return i.data >= today; });
      const passati = interventi.filter(function (i) { return i.data < today; });
      $box.html(intGroup('In programma / futuri', futuri) + intGroup('Passati', passati));
    }).fail(function (xhr) { $('#intBox').html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  function intGroup(title, list) {
    if (!list.length) return '';
    return '<div style="margin-bottom:18px">' +
      '<div class="muted" style="font-weight:700;text-transform:uppercase;font-size:.74rem;letter-spacing:.03em;margin:6px 0">' + App.esc(title) + ' (' + list.length + ')</div>' +
      '<div class="table-wrap"><table class="data stack"><thead><tr>' +
        '<th>Data</th><th>Tipologia</th><th>Tecnico</th><th>Stato</th><th></th>' +
      '</tr></thead><tbody>' +
      list.map(function (i) {
        return '<tr>' +
          '<td data-label="Data"><strong>' + App.esc(i.data) + '</strong></td>' +
          '<td data-label="Tipologia">' + App.esc(i.tipologia) + '</td>' +
          '<td data-label="Tecnico">' + App.esc(i.tecnico_nome) + '</td>' +
          '<td data-label="Stato">' + statoBadge(i.stato) + '</td>' +
          '<td class="actions" data-label="Azioni" style="white-space:nowrap">' +
            '<button class="btn small js-openint" data-id="' + i.id + '">Apri</button> ' +
            '<button class="btn small js-addarea-int" data-id="' + i.id + '">+ Area</button> ' +
            '<a class="btn small primary" target="_blank" href="' + App.base + '/api/report.php?action=download&intervento_id=' + i.id + '">🖨 Stampa PDF</a>' +
          '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div></div>';
  }

  $(document).on('click', '#intBox .js-openint', function () { location.hash = '#/intervento/' + $(this).data('id'); });

  $(document).on('click', '#intBox .js-addarea-int', function (e) {
    e.stopPropagation();
    const intId = $(this).data('id');
    App.formPreset = { intervento_id: intId };
    location.hash = '#/area-form/' + localeId;
  });

  function openSelectInterventoModal() {
    const options = interventi.map(function (i) {
      return '<option value="' + i.id + '">Intervento del ' + App.esc(i.data) + ' (' + App.esc(i.tipologia) + ') — ' + App.esc(i.tecnico_nome) + '</option>';
    }).join('');
    
    const bodyHtml = 
      '<div class="field"><label>Seleziona l\'intervento a cui associare la nuova area *</label>' +
        '<select class="select" id="sel_int_id">' +
          '<option value="">Seleziona un intervento…</option>' +
          options +
          '<option value="new">[ + Crea un nuovo intervento ]</option>' +
        '</select>' +
      '</div>' +
      '<div id="inlineNewInt" style="display:none; border-top:1px solid var(--border); padding-top:14px; margin-top:14px;">' +
        '<h4 style="margin:0 0 12px 0;">Nuovo Intervento</h4>' +
        '<div class="field"><label>Tecnico *</label><select class="select" id="ni_tec"><option value="">Seleziona…</option>' +
          tecnici.map(function (t) { return '<option value="' + t.id + '">' + App.esc(t.nome) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="form-row">' +
          '<div class="field"><label>Data *</label><input class="input" type="date" id="ni_data"></div>' +
          '<div class="field"><label>Tipologia</label><select class="select" id="ni_tipo">' +
            ['programmato', 'straordinario', 'primo_impianto', 'sopralluogo'].map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('') +
          '</select></div>' +
        '</div>' +
      '</div>';
      
    App.modal({
      title: 'Nuova area · Associa Intervento',
      bodyHtml: bodyHtml,
      okText: 'Procedi',
      onOpen: function ($bd) {
        $bd.find('#sel_int_id').on('change', function () {
          $bd.find('#inlineNewInt').toggle($(this).val() === 'new');
        });
      },
      onOk: function (close, $bd) {
        const val = $bd.find('#sel_int_id').val();
        if (!val) { App.err('Seleziona un intervento o creane uno nuovo'); return; }
        
        if (val === 'new') {
          const payload = {
            locale_id: localeId,
            tecnico_id: $bd.find('#ni_tec').val(),
            data: $bd.find('#ni_data').val(),
            tipologia: $bd.find('#ni_tipo').val(),
          };
          if (!payload.tecnico_id || !payload.data) { App.err('Tecnico e data sono obbligatori per il nuovo intervento'); return; }
          
          const $btn = $bd.find('.js-ok').prop('disabled', true).text('Creazione intervento…');
          App.apiPost('/api/interventi.php?action=create', payload).done(function (res) {
            close();
            App.ok('Nuovo intervento creato');
            App.formPreset = { intervento_id: res.id };
            location.hash = '#/area-form/' + localeId;
          }).fail(function (xhr) {
            $btn.prop('disabled', false).text('Procedi');
            App.err(App.errMsg(xhr));
          });
        } else {
          close();
          App.formPreset = { intervento_id: parseInt(val, 10) };
          location.hash = '#/area-form/' + localeId;
        }
      }
    });
  }

  function loadAree() {
    App.apiGet('/api/aree.php?action=list', { locale_id: localeId }).done(function (res) {
      const aree = res.aree || [];
      const $box = $('#areeBox');
      if (!aree.length) { $box.html(App.emptyHtml('Nessuna area associata a interventi.', '🗺️')); return; }
      $box.empty();

      const grouped = {};
      aree.forEach(function (a) {
        const intId = a.intervento_id || 0;
        if (!grouped[intId]) grouped[intId] = [];
        grouped[intId].push(a);
      });

      Object.keys(grouped).forEach(function (intId) {
        const areasInGroup = grouped[intId];
        const intIdNum = parseInt(intId, 10);
        let titleHtml = '';
        
        if (intIdNum > 0) {
          const matchingInt = interventi.find(function (i) { return i.id === intIdNum; });
          const desc = matchingInt 
            ? 'Intervento del ' + matchingInt.data + ' (' + matchingInt.tipologia + ')'
            : 'Intervento #' + intIdNum;
          titleHtml = '<div class="section-title" style="margin: 16px 0 12px; border-bottom: 1px solid var(--border); padding-bottom: 6px;">' + App.esc(desc) + '</div>';
        } else {
          titleHtml = '<div class="section-title" style="margin: 16px 0 12px; border-bottom: 1px solid var(--border); padding-bottom: 6px;">Aree generali (non associate a interventi)</div>';
        }
        
        const $groupWrapper = $('<div class="area-group-wrapper" style="margin-bottom:24px"></div>');
        $groupWrapper.append(titleHtml);
        
        const $grid = $('<div class="asset-grid"></div>');
        areasInGroup.forEach(function (a) {
          const $sec = $(
            '<div class="card" style="margin-bottom:16px">' +
              '<div class="card-top" style="justify-content:space-between">' +
                '<div class="title">' + App.esc(a.nome) +
                  ' <span class="badge ' + (a.tipo === 'esterna' ? 'warn' : 'green') + '">' + a.tipo + '</span></div>' +
                '<div class="card-top-actions">' +
                  '<button class="btn small primary js-addpos" data-area="' + a.id + '">+ Postazione</button> ' +
                  '<button class="btn small js-edita" data-id="' + a.id + '" data-nome="' + App.esc(a.nome) + '" data-tipo="' + a.tipo + '">Modifica</button> ' +
                  '<button class="btn small danger js-dela" data-id="' + a.id + '">Elimina</button>' +
                '</div>' +
              '</div>' +
              '<div class="pos-wrap" data-area="' + a.id + '">' + App.loadingHtml + '</div>' +
            '</div>'
          );
          $grid.append($sec);
          loadPostazioni(a.id);
        });
        
        $groupWrapper.append($grid);
        $box.append($groupWrapper);
      });
    });
  }

  function loadPostazioni(areaId) {
    const $w = $('.pos-wrap[data-area="' + areaId + '"]');
    App.apiGet('/api/postazioni.php?action=list', { area_id: areaId }).done(function (res) {
      const ps = res.postazioni || [];
      if (!ps.length) { $w.html('<div class="muted" style="padding:8px 0">Nessuna postazione in quest\'area.</div>'); return; }
      $w.html(
        '<div class="table-wrap"><table class="data stack"><thead><tr>' +
          '<th>N°</th><th>Ubicazione</th><th>Dispositivo</th><th>Rischio</th><th>QR</th><th></th>' +
        '</tr></thead><tbody>' +
        ps.map(function (p) {
          return '<tr>' +
            '<td data-label="N°"><strong>' + p.numero + '</strong></td>' +
            '<td data-label="Ubicazione">' + App.esc(p.ubicazione || '—') + '</td>' +
            '<td data-label="Dispositivo">' + App.esc(p.tipo_nome) + ' <span class="muted">(' + p.metrica + ')</span></td>' +
            '<td data-label="Rischio"><span class="badge ' + gradoCls(p.grado_rischio) + '">' + p.grado_rischio + '</span></td>' +
            '<td data-label="QR"><code>' + App.esc(p.qr_code) + '</code></td>' +
            '<td class="actions" data-label="Azioni" style="white-space:nowrap">' +
              '<button class="btn small js-qr" data-code="' + App.esc(p.qr_code) + '" data-num="' + p.numero + '" data-ub="' + App.esc(p.ubicazione || '') + '">QR</button> ' +
              '<button class="btn small js-editp" data-id="' + p.id + '">✎</button> ' +
              '<button class="btn small danger js-delp" data-id="' + p.id + '">✕</button>' +
            '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>'
      );
    });
  }

  function gradoCls(g) { return g === 'alto' ? 'red' : (g === 'medio' ? 'warn' : 'gray'); }

  /* ---------- Aree events ---------- */
  $(document).on('click', '#areeBox .js-edita', function () {
    location.hash = '#/area-form/' + localeId + '/' + $(this).data('id');
  });
  $(document).on('click', '#areeBox .js-dela', function () {
    const id = $(this).data('id');
    App.confirm('Elimina area', 'Eliminare l\'area e tutte le sue postazioni?', function () {
      App.apiPost('/api/aree.php?action=delete&id=' + id).done(function () { App.ok('Area eliminata'); loadAree(); })
        .fail(function (xhr) { App.err(App.errMsg(xhr)); });
    }, 'Elimina');
  });
  $(document).on('click', '#areeBox .js-addpos', function () { openPosForm(null, $(this).data('area')); });
  $(document).on('click', '#areeBox .js-editp', function () {
    const id = $(this).data('id');
    App.apiGet('/api/postazioni.php?action=get', { id: id }).done(function (res) { openPosForm(res.postazione, res.postazione.area_id); });
  });
  $(document).on('click', '#areeBox .js-delp', function () {
    const id = $(this).data('id');
    App.confirm('Elimina postazione', 'Eliminare questa postazione?', function () {
      App.apiPost('/api/postazioni.php?action=delete&id=' + id).done(function () { App.ok('Eliminata'); loadAree(); })
        .fail(function (xhr) { App.err(App.errMsg(xhr)); });
    }, 'Elimina');
  });
  $(document).on('click', '#areeBox .js-qr', function () {
    showQr($(this).data('code'), $(this).data('num'), $(this).data('ub'));
  });

  /* ---------- Forms ---------- */
  function openPosForm(p, areaId) {
    const isEdit = !!p; p = p || {};
    const tipiOpts = tipi.map(function (t) {
      return '<option value="' + t.id + '"' + (p.tipo_dispositivo_id == t.id ? ' selected' : '') + '>' + App.esc(t.nome) + ' (' + t.metrica + ')</option>';
    }).join('');
    const body =
      '<div class="form-row">' +
        '<div class="field"><label>Numero *</label><input class="input" type="number" id="f_num" value="' + App.esc(p.numero) + '"></div>' +
        '<div class="field"><label>Grado rischio</label><select class="select" id="f_grado">' +
          ['minimo', 'medio', 'alto'].map(function (g) { return '<option' + (p.grado_rischio === g ? ' selected' : '') + '>' + g + '</option>'; }).join('') +
        '</select></div>' +
      '</div>' +
      '<div class="field"><label>Ubicazione</label><input class="input" id="f_ub" value="' + App.esc(p.ubicazione) + '" placeholder="es. Sala sotto frigo"></div>' +
      '<div class="field"><label>Tipo dispositivo *</label><select class="select" id="f_tipo">' + tipiOpts + '</select></div>' +
      (isEdit ? '<div class="field"><label><input type="checkbox" id="f_attiva"' + (p.attiva == 1 ? ' checked' : '') + '> Attiva</label></div>' : '');

    App.modal({
      title: isEdit ? 'Modifica postazione' : 'Nuova postazione',
      bodyHtml: body, okText: isEdit ? 'Salva' : 'Crea',
      onOk: function (close, $bd) {
        const payload = {
          area_id: areaId,
          numero: $bd.find('#f_num').val(),
          ubicazione: $bd.find('#f_ub').val().trim(),
          tipo_dispositivo_id: $bd.find('#f_tipo').val(),
          grado_rischio: $bd.find('#f_grado').val(),
          attiva: isEdit ? ($bd.find('#f_attiva').is(':checked') ? 1 : 0) : 1,
        };
        if (!payload.numero) { App.err('Il numero è obbligatorio'); return; }
        if (!payload.tipo_dispositivo_id) { App.err('Seleziona un tipo dispositivo'); return; }
        const req = isEdit ? App.apiPut('/api/postazioni.php?action=update&id=' + p.id, payload)
                           : App.apiPost('/api/postazioni.php?action=create', payload);
        req.done(function () { close(); App.ok('Salvato'); loadAree(); }).fail(function (xhr) { App.err(App.errMsg(xhr)); });
      },
    });
  }

  /* ---------- QR display ---------- */
  function showQr(code, numero, ubicazione) {
    App.modal({
      title: 'QR postazione n° ' + numero,
      bodyHtml:
        '<div style="text-align:center">' +
          '<div id="qrTarget" style="display:inline-block;padding:12px;background:#fff;border:1px solid var(--border);border-radius:8px"></div>' +
          '<p style="margin-top:12px"><code>' + App.esc(code) + '</code></p>' +
          (ubicazione ? '<p class="muted">' + App.esc(ubicazione) + '</p>' : '') +
        '</div>',
      okText: 'Stampa',
      cancelText: 'Chiudi',
      onOpen: function ($bd) {
        // qrcodejs
        new QRCode($bd.find('#qrTarget')[0], { text: code, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
      },
      onOk: function (close, $bd) {
        const html = '<div style="text-align:center;font-family:sans-serif">' + $bd.find('#qrTarget').html() +
          '<h2>Postazione ' + numero + '</h2><p>' + App.esc(ubicazione || '') + '</p><p><code>' + App.esc(code) + '</code></p></div>';
        const w = window.open('', '_blank', 'width=420,height=520');
        w.document.write('<html><head><title>QR ' + code + '</title></head><body onload="window.print()">' + html + '</body></html>');
        w.document.close();
      },
    });
  }

  App.views['locale'] = { render: render };
})(jQuery);
