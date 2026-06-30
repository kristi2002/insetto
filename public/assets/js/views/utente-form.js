/* utente-form.js — pagina intera Nuovo/Modifica utente.
   Route: #/utenti-form  (nuovo)  ·  #/utenti-form/:id  (modifica) */
(function ($) {
  'use strict';
  App.views = App.views || {};
  const RUOLI = ['admin', 'supervisore', 'tecnico', 'cliente'];

  function render($view, id) {
    const ret = '#/utenti';
    // Carica clienti (per il select) e, se modifica, l'utente.
    $view.html(App.loadingHtml);
    const reqs = [App.apiGet('/api/clienti.php?action=list')];
    if (id) reqs.push(App.apiGet('/api/users.php?action=get', { id: id }));
    $.when.apply($, reqs).done(function (cliRes, userRes) {
      const clienti = (Array.isArray(cliRes) ? cliRes[0] : cliRes).clienti || [];
      const u = id ? userRes[0].user : null;
      paint($view, ret, clienti, u);
    }).fail(function (xhr) { $view.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  function paint($view, ret, clienti, u) {
    const isEdit = !!u; u = u || {};
    const cliOpts = '<option value="">— Nessuno —</option>' + clienti.map(function (c) {
      return '<option value="' + c.id + '"' + (u.cliente_id == c.id ? ' selected' : '') + '>' + App.esc(c.ragione_sociale) + '</option>';
    }).join('');

    $view.html(
      '<div class="form-page">' +
        '<a class="btn-back" href="' + ret + '">← Indietro</a>' +
        '<h1 class="form-page-title">' + (isEdit ? 'Modifica utente' : 'Nuovo utente') + '</h1>' +
        '<div class="form-page-card">' +
          '<div class="form-row">' +
            '<div class="field"><label>Nome *</label><input class="input" id="u_nome" value="' + App.esc(u.nome) + '"></div>' +
            '<div class="field"><label>Email *</label><input class="input" type="email" id="u_email" value="' + App.esc(u.email) + '"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="field"><label>Ruolo</label><select class="select" id="u_ruolo">' +
              RUOLI.map(function (r) { return '<option' + (u.ruolo === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="field" id="cliWrap"><label>Cliente associato</label><select class="select" id="u_cli">' + cliOpts + '</select></div>' +
          '</div>' +
          '<div class="field"><label>Password ' + (isEdit ? '(lascia vuoto per non cambiarla)' : '*') + '</label><input class="input" type="password" id="u_pwd" autocomplete="new-password"></div>' +
          '<div class="form-page-actions">' +
            '<a class="btn" href="' + ret + '">Annulla</a>' +
            '<button class="btn primary" id="formSave">' + (isEdit ? 'Salva modifiche' : 'Crea utente') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    const sync = function () { $('#cliWrap').toggle($('#u_ruolo').val() === 'cliente'); };
    $view.on('change', '#u_ruolo', sync); sync();

    $view.find('#formSave').on('click', function () {
      const payload = {
        nome: $('#u_nome').val().trim(), email: $('#u_email').val().trim(),
        ruolo: $('#u_ruolo').val(), cliente_id: $('#u_cli').val() || null, password: $('#u_pwd').val(),
      };
      if (!payload.nome || !payload.email) { App.err('Nome ed email obbligatori'); return; }
      if (!isEdit && (payload.password || '').length < 6) { App.err('Password min 6 caratteri'); return; }
      const $b = $(this).prop('disabled', true).text('Salvataggio…');
      const req = isEdit ? App.apiPut('/api/users.php?action=update&id=' + u.id, payload)
                         : App.apiPost('/api/users.php?action=create', payload);
      req.done(function () { App.ok('Salvato'); location.hash = ret; }).fail(function (xhr) {
        $b.prop('disabled', false).text(isEdit ? 'Salva modifiche' : 'Crea utente');
        const f = xhr.responseJSON && xhr.responseJSON.fields;
        App.err(f ? Object.values(f).join(' · ') : App.errMsg(xhr));
      });
    });
  }

  App.views['utenti-form'] = { render: render };
})(jQuery);
