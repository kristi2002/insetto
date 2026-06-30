/* cliente-form.js — pagina intera Nuovo/Modifica cliente.
   Route: #/clienti-form  (nuovo)  ·  #/clienti-form/:id  (modifica) */
(function ($) {
  'use strict';
  App.views = App.views || {};
  const STATI = ['attivo', 'inattivo', 'archiviato'];

  function render($view, id) {
    const ret = App.formReturn || '#/clienti';
    App.formReturn = null;
    if (id) {
      $view.html(App.loadingHtml);
      App.apiGet('/api/clienti.php?action=get', { id: id }).done(function (res) { paint($view, res.cliente, ret); })
        .fail(function (xhr) { $view.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
    } else {
      paint($view, null, ret);
    }
  }

  function paint($view, c, ret) {
    const isEdit = !!c; c = c || {};
    $view.html(
      '<div class="form-page">' +
        '<a class="btn-back" href="' + ret + '">← Indietro</a>' +
        '<h1 class="form-page-title">' + (isEdit ? 'Modifica cliente' : 'Nuovo cliente') + '</h1>' +
        '<div class="form-page-card">' +
          '<div class="field"><label>Ragione sociale *</label><input class="input" id="f_rs" value="' + App.esc(c.ragione_sociale) + '"></div>' +
          '<div class="form-row">' +
            '<div class="field"><label>Partita IVA</label><input class="input" id="f_piva" value="' + App.esc(c.partita_iva) + '"></div>' +
            '<div class="field"><label>Stato</label><select class="select" id="f_stato">' +
              STATI.map(function (s) { return '<option value="' + s + '"' + (c.stato === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
            '</select></div>' +
          '</div>' +
          '<div class="field"><label>Sede legale</label><input class="input" id="f_sede" value="' + App.esc(c.sede_legale) + '"></div>' +
          '<div class="field"><label>Riferimento aziendale</label><input class="input" id="f_rif" value="' + App.esc(c.riferimento_aziendale) + '"></div>' +
          '<div class="form-row">' +
            '<div class="field"><label>Email</label><input class="input" type="email" id="f_email" value="' + App.esc(c.email) + '"></div>' +
            '<div class="field"><label>Telefono</label><input class="input" id="f_tel" value="' + App.esc(c.telefono) + '"></div>' +
          '</div>' +
          '<div class="field"><label>Note interne</label><textarea class="textarea" id="f_note">' + App.esc(c.note_interne) + '</textarea></div>' +
          '<div class="form-page-actions">' +
            '<a class="btn" href="' + ret + '">Annulla</a>' +
            '<button class="btn primary" id="formSave">' + (isEdit ? 'Salva modifiche' : 'Crea cliente') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    $view.find('#formSave').on('click', function () {
      const payload = {
        ragione_sociale: $('#f_rs').val().trim(), partita_iva: $('#f_piva').val().trim(),
        sede_legale: $('#f_sede').val().trim(), riferimento_aziendale: $('#f_rif').val().trim(),
        email: $('#f_email').val().trim(), telefono: $('#f_tel').val().trim(),
        note_interne: $('#f_note').val().trim(), stato: $('#f_stato').val(),
      };
      if (!payload.ragione_sociale) { App.err('La ragione sociale è obbligatoria'); return; }
      const $b = $(this).prop('disabled', true).text('Salvataggio…');
      const req = isEdit ? App.apiPut('/api/clienti.php?action=update&id=' + c.id, payload)
                         : App.apiPost('/api/clienti.php?action=create', payload);
      req.done(function () { App.ok(isEdit ? 'Cliente aggiornato' : 'Cliente creato'); location.hash = ret; })
         .fail(function (xhr) { $b.prop('disabled', false).text(isEdit ? 'Salva modifiche' : 'Crea cliente'); App.err(App.errMsg(xhr)); });
    });
  }

  App.views['clienti-form'] = { render: render };
})(jQuery);
