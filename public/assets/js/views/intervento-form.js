/* intervento-form.js — pagina intera Nuovo/Modifica intervento.
   Route: #/intervento-form  (nuovo)  ·  #/intervento-form/:id  (modifica)
   Preset opzionale via App.formPreset = { cliente_id, locale_id }. */
(function ($) {
  'use strict';
  App.views = App.views || {};
  const TIPI = ['programmato', 'straordinario', 'primo_impianto', 'sopralluogo'];

  function render($view, id) {
    const ret = App.formReturn || '#/interventi';
    App.formReturn = null;
    const preset = App.formPreset || null;
    App.formPreset = null;

    if (id) {
      $view.html(App.loadingHtml);
      App.apiGet('/api/interventi.php?action=get', { id: id }).done(function (res) {
        const i = res.intervento;
        paint($view, ret, { id: i.id, cliente_id: i.cliente_id, locale_id: i.locale_id, tecnico_id: i.tecnico_id, data: i.data, tipologia: i.tipologia });
      }).fail(function (xhr) { $view.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
    } else {
      paint($view, ret, preset ? { cliente_id: preset.cliente_id, locale_id: preset.locale_id } : null);
    }
  }

  function paint($view, ret, data) {
    const isEdit = !!(data && data.id);
    data = data || {};
    $view.html(
      '<div class="form-page">' +
        '<a class="btn-back" href="' + ret + '">← Indietro</a>' +
        '<h1 class="form-page-title">' + (isEdit ? 'Modifica intervento' : 'Nuovo intervento') + '</h1>' +
        '<div class="form-page-card">' +
          '<div class="field"><label>Cliente *</label><select class="select" id="i_cli"><option value="">Caricamento…</option></select></div>' +
          '<div class="field"><label>Locale *</label><select class="select" id="i_loc"><option value="">Seleziona prima il cliente</option></select></div>' +
          '<div class="field"><label>Tecnico *</label><select class="select" id="i_tec"><option value="">Caricamento…</option></select></div>' +
          '<div class="form-row">' +
            '<div class="field"><label>Data *</label><input class="input" type="date" id="i_data" value="' + App.esc(data.data) + '"></div>' +
            '<div class="field"><label>Tipologia</label><select class="select" id="i_tipo">' +
              TIPI.map(function (t) { return '<option value="' + t + '"' + (data.tipologia === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
            '</select></div>' +
          '</div>' +
          '<div class="form-page-actions">' +
            '<a class="btn" href="' + ret + '">Annulla</a>' +
            '<button class="btn primary" id="formSave">' + (isEdit ? 'Salva modifiche' : 'Crea intervento') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    // Popola clienti + tecnici
    App.apiGet('/api/clienti.php?action=list', { stato: 'attivo' }).done(function (res) {
      $('#i_cli').html('<option value="">Seleziona…</option>' +
        (res.clienti || []).map(function (c) { return '<option value="' + c.id + '"' + (data.cliente_id == c.id ? ' selected' : '') + '>' + App.esc(c.ragione_sociale) + '</option>'; }).join(''));
      if (data.cliente_id) { loadLocali(data.cliente_id, data.locale_id); }
    });
    App.apiGet('/api/interventi.php?action=tecnici').done(function (res) {
      $('#i_tec').html('<option value="">Seleziona…</option>' +
        (res.tecnici || []).map(function (t) { return '<option value="' + t.id + '"' + (data.tecnico_id == t.id ? ' selected' : '') + '>' + App.esc(t.nome) + '</option>'; }).join(''));
    });

    $view.on('change', '#i_cli', function () { loadLocali($(this).val(), null); });

    $view.find('#formSave').on('click', function () {
      const payload = {
        locale_id: $('#i_loc').val(), tecnico_id: $('#i_tec').val(),
        data: $('#i_data').val(), tipologia: $('#i_tipo').val(),
      };
      if (!payload.locale_id || !payload.tecnico_id || !payload.data) { App.err('Cliente, locale, tecnico e data sono obbligatori'); return; }
      const $b = $(this).prop('disabled', true).text('Salvataggio…');
      const req = isEdit ? App.apiPut('/api/interventi.php?action=update&id=' + data.id, payload)
                         : App.apiPost('/api/interventi.php?action=create', payload);
      req.done(function () { App.ok(isEdit ? 'Intervento aggiornato' : 'Intervento creato'); location.hash = ret; })
         .fail(function (xhr) { $b.prop('disabled', false).text(isEdit ? 'Salva modifiche' : 'Crea intervento'); App.err(App.errMsg(xhr)); });
    });
  }

  function loadLocali(clienteId, selLocaleId) {
    const $loc = $('#i_loc').html('<option value="">Caricamento…</option>');
    if (!clienteId) { $loc.html('<option value="">Seleziona prima il cliente</option>'); return; }
    App.apiGet('/api/locali.php?action=list', { cliente_id: clienteId }).done(function (res) {
      $loc.html('<option value="">Seleziona…</option>' +
        (res.locali || []).map(function (l) { return '<option value="' + l.id + '"' + (selLocaleId == l.id ? ' selected' : '') + '>' + App.esc(l.nome) + '</option>'; }).join(''));
    });
  }

  App.views['intervento-form'] = { render: render };
})(jQuery);
