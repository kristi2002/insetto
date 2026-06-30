/* tipo-form.js — pagina intera Nuovo/Modifica tipo dispositivo.
   Route: #/tipo-form  (nuovo)  ·  #/tipo-form/:id  (modifica) */
(function ($) {
  'use strict';
  App.views = App.views || {};

  function render($view, id) {
    const ret = '#/configurazione';
    if (id) {
      $view.html(App.loadingHtml);
      App.apiGet('/api/tipi_dispositivo.php?action=get', { id: id }).done(function (res) { paint($view, ret, res.tipo); })
        .fail(function (xhr) { $view.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
    } else {
      paint($view, ret, null);
    }
  }

  function paint($view, ret, t) {
    const isEdit = !!t; t = t || {};
    $view.html(
      '<div class="form-page">' +
        '<a class="btn-back" href="' + ret + '">← Indietro</a>' +
        '<h1 class="form-page-title">' + (isEdit ? 'Modifica tipo dispositivo' : 'Nuovo tipo dispositivo') + '</h1>' +
        '<div class="form-page-card">' +
          '<div class="field"><label>Nome *</label><input class="input" id="t_nome" value="' + App.esc(t.nome) + '" placeholder="es. Contenitore con esca"></div>' +
          '<div class="form-row">' +
            '<div class="field"><label>Metrica</label><select class="select" id="t_metrica">' +
              '<option value="catture"' + (t.metrica === 'catture' ? ' selected' : '') + '>catture</option>' +
              '<option value="consumo"' + (t.metrica === 'consumo' ? ' selected' : '') + '>consumo</option>' +
            '</select></div>' +
            '<div class="field"><label>Limite soglia</label><input class="input" type="number" min="0" id="t_limite" value="' + (t.limite != null ? t.limite : 1) + '"></div>' +
          '</div>' +
          '<div class="form-page-actions">' +
            '<a class="btn" href="' + ret + '">Annulla</a>' +
            '<button class="btn primary" id="formSave">' + (isEdit ? 'Salva modifiche' : 'Crea tipo') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    $view.find('#formSave').on('click', function () {
      const payload = { nome: $('#t_nome').val().trim(), metrica: $('#t_metrica').val(), limite: $('#t_limite').val() };
      if (!payload.nome) { App.err('Il nome è obbligatorio'); return; }
      const $b = $(this).prop('disabled', true).text('Salvataggio…');
      const req = isEdit ? App.apiPut('/api/tipi_dispositivo.php?action=update&id=' + t.id, payload)
                         : App.apiPost('/api/tipi_dispositivo.php?action=create', payload);
      req.done(function () { App.ok('Salvato'); location.hash = ret; })
         .fail(function (xhr) { $b.prop('disabled', false).text(isEdit ? 'Salva modifiche' : 'Crea tipo'); App.err(App.errMsg(xhr)); });
    });
  }

  App.views['tipo-form'] = { render: render };
})(jQuery);
