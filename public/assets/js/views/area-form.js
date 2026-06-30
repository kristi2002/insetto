/* area-form.js — pagina intera Nuova/Modifica area.
   Route: #/area-form/:localeId  (nuova)  ·  #/area-form/:localeId/:areaId  (modifica) */
(function ($) {
  'use strict';
  App.views = App.views || {};

  function render($view, arg, args) {
    args = args || [];
    const localeId = parseInt(args[0], 10);
    const areaId = args[1] ? parseInt(args[1], 10) : null;
    if (!localeId) { location.hash = '#/clienti'; return; }
    const ret = '#/locale/' + localeId;

    const preset = App.formPreset || {};
    App.formPreset = null;

    if (areaId) {
      $view.html(App.loadingHtml);
      App.apiGet('/api/aree.php?action=get', { id: areaId }).done(function (res) { paint($view, localeId, ret, res.area, preset); })
        .fail(function (xhr) { $view.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
    } else {
      paint($view, localeId, ret, null, preset);
    }
  }

  function paint($view, localeId, ret, a, preset) {
    const isEdit = !!a; a = a || {};
    $view.html(
      '<div class="form-page">' +
        '<a class="btn-back" href="' + ret + '">← Indietro</a>' +
        '<h1 class="form-page-title">' + (isEdit ? 'Modifica area' : 'Nuova area') + '</h1>' +
        '<div class="form-page-card">' +
          '<div class="field"><label>Nome area *</label><input class="input" id="a_nome" value="' + App.esc(a.nome) + '" placeholder="es. Cucina"></div>' +
          '<div class="field"><label>Tipo</label><select class="select" id="a_tipo">' +
            '<option value="interna"' + (a.tipo === 'interna' ? ' selected' : '') + '>Interna</option>' +
            '<option value="esterna"' + (a.tipo === 'esterna' ? ' selected' : '') + '>Esterna</option>' +
          '</select></div>' +
          '<div class="form-page-actions">' +
            '<a class="btn" href="' + ret + '">Annulla</a>' +
            '<button class="btn primary" id="formSave">' + (isEdit ? 'Salva modifiche' : 'Crea area') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    $view.find('#formSave').on('click', function () {
      const payload = { 
        locale_id: localeId, 
        nome: $('#a_nome').val().trim(), 
        tipo: $('#a_tipo').val(),
        intervento_id: preset.intervento_id || a.intervento_id
      };
      if (!payload.nome) { App.err('Il nome è obbligatorio'); return; }
      const $b = $(this).prop('disabled', true).text('Salvataggio…');
      const req = isEdit ? App.apiPut('/api/aree.php?action=update&id=' + a.id, payload)
                         : App.apiPost('/api/aree.php?action=create', payload);
      req.done(function () { App.ok('Salvato'); location.hash = ret; })
         .fail(function (xhr) { $b.prop('disabled', false).text(isEdit ? 'Salva modifiche' : 'Crea area'); App.err(App.errMsg(xhr)); });
    });
  }

  App.views['area-form'] = { render: render };
})(jQuery);
