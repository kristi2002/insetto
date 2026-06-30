/* locale-form.js — pagina intera Nuovo/Modifica locale.
   Route: #/locale-form/:clienteId  (nuovo)  ·  #/locale-form/:clienteId/:localeId  (modifica) */
(function ($) {
  'use strict';
  App.views = App.views || {};
  const STATI = ['attivo', 'inattivo', 'archiviato'];

  function render($view, arg, args) {
    args = args || [];
    const clienteId = parseInt(args[0], 10);
    const localeId = args[1] ? parseInt(args[1], 10) : null;
    if (!clienteId) { location.hash = '#/clienti'; return; }
    const ret = '#/locali/' + clienteId;

    if (localeId) {
      $view.html(App.loadingHtml);
      App.apiGet('/api/locali.php?action=get', { id: localeId }).done(function (res) { paint($view, clienteId, ret, res.locale); })
        .fail(function (xhr) { $view.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
    } else {
      paint($view, clienteId, ret, null);
    }
  }

  function paint($view, clienteId, ret, l) {
    const isEdit = !!l; l = l || {};
    $view.html(
      '<div class="form-page">' +
        '<a class="btn-back" href="' + ret + '">← Indietro</a>' +
        '<h1 class="form-page-title">' + (isEdit ? 'Modifica locale' : 'Nuovo locale') + '</h1>' +
        '<div class="form-page-card">' +
          '<div class="field"><label>Nome locale *</label><input class="input" id="f_nome" value="' + App.esc(l.nome) + '" placeholder="es. Sito logistico"></div>' +
          '<div class="field"><label>Indirizzo</label><input class="input" id="f_ind" value="' + App.esc(l.indirizzo) + '"></div>' +
          '<div class="form-row">' +
            '<div class="field"><label>Frequenza servizio</label><input class="input" id="f_freq" value="' + App.esc(l.frequenza_servizio) + '" placeholder="es. mensile"></div>' +
            '<div class="field"><label>Stato</label><select class="select" id="f_stato">' +
              STATI.map(function (s) { return '<option' + (l.stato === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
          '</div>' +
          '<div class="field"><label>Foto (URL anteprima)</label><input class="input" id="f_foto" value="' + App.esc(l.foto_path) + '" placeholder="https://…"></div>' +
          '<div class="form-page-actions">' +
            '<a class="btn" href="' + ret + '">Annulla</a>' +
            '<button class="btn primary" id="formSave">' + (isEdit ? 'Salva modifiche' : 'Crea locale') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    $view.find('#formSave').on('click', function () {
      const p = {
        cliente_id: clienteId, nome: $('#f_nome').val().trim(), indirizzo: $('#f_ind').val().trim(),
        frequenza_servizio: $('#f_freq').val().trim(), stato: $('#f_stato').val(), foto_path: $('#f_foto').val().trim(),
      };
      if (!p.nome) { App.err('Il nome è obbligatorio'); return; }
      const $b = $(this).prop('disabled', true).text('Salvataggio…');
      const req = isEdit ? App.apiPut('/api/locali.php?action=update&id=' + l.id, p)
                         : App.apiPost('/api/locali.php?action=create', p);
      req.done(function () { App.ok('Salvato'); location.hash = ret; })
         .fail(function (xhr) { $b.prop('disabled', false).text(isEdit ? 'Salva modifiche' : 'Crea locale'); App.err(App.errMsg(xhr)); });
    });
  }

  App.views['locale-form'] = { render: render };
})(jQuery);
