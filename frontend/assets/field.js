/* field.js — app tecnico in campo (mobile-first). Richiede core.js e html5-qrcode. */
(function ($) {
  'use strict';

  let current = null;        // intervento corrente
  let activeTab = 'letture';  // letture | manutenzione | esito
  let areaIndex = 0;          // area mostrata nelle letture (una alla volta)
  let qr = null;
  let showAll = false;

  const $app = $('#fApp');
  const STATI_TRAPPOLA = ['OK', 'da sostituire', 'mancante', 'manomessa'];

  /* ---------- Avvio ---------- */
  App.loadSession().done(function () { renderList(); });
  $('#fLogout').on('click', function () { App.logout(); });
  $('#fBack').on('click', function () { renderList(); });
  $('#scanClose').on('click', stopScanner);

  function setHeader(title, back) {
    $('#fTitle').text(title);
    $('#fBack').toggleClass('hidden', !back);
  }
  function find(pid) { return current.postazioni.find(function (x) { return x.id == pid; }); }
  function gradoBadge(g) {
    const cls = g === 'alto' ? 'red' : (g === 'medio' ? 'warn' : 'gray');
    return '<span class="badge ' + cls + '">' + App.esc(g || 'minimo') + '</span>';
  }

  /* ---------- Lista interventi ---------- */
  function renderList() {
    current = null;
    setHeader(showAll ? 'Tutti gli interventi' : 'Interventi di oggi', false);
    $app.html(App.loadingHtml);
    App.apiGet('/api/interventi.php?action=list', showAll ? {} : { oggi: 1 }).done(function (res) {
      const items = res.interventi || [];
      let html =
        '<div class="tabbar"><button class="' + (!showAll ? 'active' : '') + '" data-all="0">Oggi</button>' +
        '<button class="' + (showAll ? 'active' : '') + '" data-all="1">Tutti</button></div>';
      html += items.length ? items.map(intCard).join('')
        : App.emptyHtml(showAll ? 'Nessun intervento.' : 'Nessun intervento per oggi.', '🗓️');
      $app.html(html);
    }).fail(function (xhr) { $app.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  function intCard(i) {
    return '<div class="f-card clickable" data-id="' + i.id + '">' +
      '<div class="ttl">' + App.esc(i.cliente_nome) + '</div>' +
      '<div class="meta">' + App.esc(i.locale_nome) + ' · ' + App.esc(i.data) + '</div>' +
      '<div class="meta">Tipologia: ' + App.esc(i.tipologia) + '</div>' +
      '<div style="margin-top:8px">' + statoBadge(i.stato) + '</div>' +
    '</div>';
  }
  function statoBadge(s) {
    const cls = s === 'inviato' ? 'green' : (s === 'validato' ? 'warn' : 'gray');
    const txt = s === 'inviato' ? 'Inviato' : (s === 'validato' ? 'Validato' : 'Bozza');
    return '<span class="badge ' + cls + '">' + txt + '</span>';
  }

  $app.on('click', '.tabbar button[data-all]', function () { showAll = $(this).data('all') === 1; renderList(); });
  $app.on('click', '.f-card[data-id]', function () { openIntervento($(this).data('id')); });

  /* ---------- Dettaglio intervento ---------- */
  function openIntervento(id) {
    $app.html(App.loadingHtml);
    App.apiGet('/api/interventi.php?action=get', { id: id }).done(function (res) {
      current = res.intervento; activeTab = 'letture'; areaIndex = 0; paintIntervento();
    }).fail(function (xhr) { App.err(App.errMsg(xhr)); });
  }
  // Ricarica preservando tab/area (aggiorna soglie e id rilevazioni dopo il salvataggio).
  function reloadIntervento() {
    const tab = activeTab, ai = areaIndex;
    App.apiGet('/api/interventi.php?action=get', { id: current.id }).done(function (res) {
      current = res.intervento; activeTab = tab; areaIndex = Math.min(ai, Math.max(0, areas().length - 1)); paintIntervento();
    });
  }

  function areas() {
    const map = new Map();
    current.postazioni.forEach(function (p) {
      if (!map.has(p.area_id)) map.set(p.area_id, { id: p.area_id, nome: p.area_nome, tipo: p.area_tipo, postazioni: [] });
      map.get(p.area_id).postazioni.push(p);
    });
    return Array.from(map.values());
  }

  function paintIntervento() {
    const i = current;
    const locked = i.stato === 'inviato';
    setHeader(i.cliente_nome, true);
    let html =
      '<div class="f-card"><div class="ttl">' + App.esc(i.locale_nome) + '</div>' +
        '<div class="meta">' + App.esc(i.locale_indirizzo || '') + '</div>' +
        '<div class="meta">Tecnico: ' + App.esc(i.tecnico_nome) + ' · ' + App.esc(i.data) + '</div>' +
        '<div style="margin-top:8px">' + statoBadge(i.stato) + '</div>' +
      '</div>' +
      '<div class="tabbar">' +
        tabBtn('letture', 'Letture') + tabBtn('manutenzione', 'Manutenzione') + tabBtn('esito', 'Esito') +
      '</div>' +
      '<div id="tabBody"></div>';

    html += '<div class="f-actions">';
    if (!locked) { html += '<button class="btn primary" id="btnSave">💾 Salva</button>'; }
    html += '<button class="btn' + (locked ? ' primary' : '') + '" id="btnReport">Report</button></div>';

    $app.html(html);
    renderTab();
  }
  function tabBtn(key, label) {
    return '<button class="' + (activeTab === key ? 'active' : '') + '" data-tab="' + key + '">' + label + '</button>';
  }

  $app.on('click', '.tabbar button[data-tab]', function () { activeTab = $(this).data('tab'); paintIntervento(); });
  $app.on('click', '#btnSave', saveLetture);
  $app.on('click', '#btnReport', generateReport);

  function renderTab() {
    if (activeTab === 'letture') renderLetture();
    else if (activeTab === 'manutenzione') renderManutenzione();
    else renderEsito();
  }

  /* ---------- Tab Letture: una area alla volta, input grandi ---------- */
  function renderLetture() {
    const $b = $('#tabBody');
    const locked = current.stato === 'inviato';
    if (!current.postazioni.length) { $b.html(App.emptyHtml('Nessuna postazione attiva in questo locale.', '📍')); return; }

    const list = areas();
    if (areaIndex >= list.length) areaIndex = 0;
    const area = list[areaIndex];

    let html = '';
    if (!locked) {
      html += '<button class="btn primary scan-btn" id="btnScan">📷 Scansiona QR postazione</button>';
    }
    // Pager area
    html += '<div class="area-pager">' +
      '<button class="pager-nav" id="areaPrev"' + (areaIndex === 0 ? ' disabled' : '') + '>‹</button>' +
      '<div class="area-pager-mid"><div class="area-pager-name">' + App.esc(area.nome) + ' · ' + App.esc(area.tipo) + '</div>' +
        '<div class="area-pager-count">Area ' + (areaIndex + 1) + ' di ' + list.length + '</div></div>' +
      '<button class="pager-nav" id="areaNext"' + (areaIndex === list.length - 1 ? ' disabled' : '') + '>›</button>' +
    '</div>';

    // Postazioni dell'area con input grandi
    area.postazioni.forEach(function (p) {
      const isConsumo = p.metrica === 'consumo';
      const val = isConsumo ? (p.consumo_esca_pct != null ? p.consumo_esca_pct : '') : (p.catture != null ? p.catture : '');
      const dis = locked ? 'disabled' : '';
      html += '<div class="pos-card" data-pid="' + p.id + '">' +
        '<div class="pos-card-head">' +
          '<span class="num">' + p.numero + '</span>' +
          '<div class="pos-card-titles"><div class="p-ub">' + App.esc(p.ubicazione || ('Postazione ' + p.numero)) + '</div>' +
            '<div class="p-sub">' + App.esc(p.tipo_nome) + '</div></div>' +
          gradoBadge(p.grado_rischio) +
        '</div>' +
        '<div class="reading-inputs">' +
          '<div class="ri-field"><label>' + (isConsumo ? 'Consumo esca (%)' : 'Catture') + '</label>' +
            '<input class="input big r-val" type="number" inputmode="numeric" min="0"' + (isConsumo ? ' max="100"' : '') +
              ' data-pid="' + p.id + '" value="' + val + '" ' + dis + '></div>' +
          '<div class="ri-field"><label>Stato trappola</label>' +
            '<select class="select big r-stato" data-pid="' + p.id + '" ' + dis + '>' +
              STATI_TRAPPOLA.map(function (s) { return '<option' + ((p.stato_trappola || 'OK') === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
            '</select></div>' +
        '</div>' +
      '</div>';
    });

    $b.html(html);
  }

  // Navigazione area
  $app.on('click', '#areaPrev', function () { if (areaIndex > 0) { areaIndex--; renderLetture(); } });
  $app.on('click', '#areaNext', function () { if (areaIndex < areas().length - 1) { areaIndex++; renderLetture(); } });
  $app.on('click', '#btnScan', startScanner);

  // Aggiornamento in memoria mentre il tecnico digita
  $app.on('input', '.r-val', function () {
    const p = find($(this).data('pid')); if (!p) return;
    const v = $(this).val();
    const num = v === '' ? null : parseInt(v, 10);
    if (p.metrica === 'consumo') p.consumo_esca_pct = num; else p.catture = num;
  });
  $app.on('change', '.r-stato', function () {
    const p = find($(this).data('pid')); if (p) p.stato_trappola = $(this).val();
  });

  /* ---------- Salvataggio transazionale (manutenzione + rilevazioni) ---------- */
  function saveLetture() {
    if (current.stato === 'inviato') { App.err('Intervento inviato: sola lettura'); return; }
    const rilevazioni = current.postazioni
      .filter(function (p) {
        return p.catture != null || p.consumo_esca_pct != null || p.rilevazione_id != null ||
          (p.stato_trappola && p.stato_trappola !== 'OK');
      })
      .map(function (p) {
        return {
          postazione_id: p.id,
          catture: p.metrica === 'consumo' ? null : (p.catture != null ? p.catture : null),
          consumo_esca_pct: p.metrica === 'consumo' ? (p.consumo_esca_pct != null ? p.consumo_esca_pct : null) : null,
          stato_trappola: p.stato_trappola || 'OK',
        };
      });
    const payload = {
      stato_strutture: current.stato_strutture || '',
      stato_serramenti: current.stato_serramenti || '',
      segnalazioni: current.segnalazioni || '',
      rilevazioni: rilevazioni,
    };
    const $btn = $('#btnSave').prop('disabled', true).text('Salvataggio…');
    App.apiPost('/api/interventi.php?action=save_letture&id=' + current.id, payload)
      .done(function () { App.ok('Salvato (' + rilevazioni.length + ' rilevazioni)'); reloadIntervento(); })
      .fail(function (xhr) { $btn.prop('disabled', false).text('💾 Salva'); App.err(App.errMsg(xhr)); });
  }

  /* ---------- Tab Manutenzione + evidenze ---------- */
  function renderManutenzione() {
    const i = current;
    const locked = i.stato === 'inviato';
    const dis = locked ? 'disabled' : '';
    let html =
      '<div class="f-section"><h3>Stato manutenzione</h3>' +
        '<div class="field"><label>Strutture</label><input class="input big" id="m_strut" value="' + App.esc(i.stato_strutture) + '" ' + dis + ' placeholder="es. Accettabile"></div>' +
        '<div class="field"><label>Serramenti</label><input class="input big" id="m_serr" value="' + App.esc(i.stato_serramenti) + '" ' + dis + '></div>' +
        '<div class="field"><label>Segnalazioni</label><textarea class="textarea" id="m_segn" ' + dis + '>' + App.esc(i.segnalazioni) + '</textarea></div>' +
        '<div class="muted" style="font-size:.82rem">Salvato col pulsante <strong>Salva</strong> in basso.</div>' +
      '</div>' +
      '<div class="f-section"><h3>Evidenze per area</h3><div id="evList"></div>' +
        (locked ? '' : '<button class="btn" id="btnAddEv" style="margin-top:10px;width:100%">+ Aggiungi evidenza</button>') +
      '</div>';
    $('#tabBody').html(html);
    renderEvidenze();
  }

  // Manutenzione tenuta in memoria (salvata dal pulsante Salva)
  $app.on('input', '#m_strut', function () { current.stato_strutture = $(this).val(); });
  $app.on('input', '#m_serr', function () { current.stato_serramenti = $(this).val(); });
  $app.on('input', '#m_segn', function () { current.segnalazioni = $(this).val(); });

  function renderEvidenze() {
    const evs = current.evidenze || [];
    const locked = current.stato === 'inviato';
    if (!evs.length) { $('#evList').html('<div class="muted">Nessuna evidenza registrata.</div>'); return; }
    $('#evList').html(evs.map(function (e) {
      return '<div class="f-card" style="margin-bottom:8px">' +
        '<div class="meta">' + (e.area_nome ? App.esc(e.area_nome) + ' · ' : '') + 'Specie: <strong>' + App.esc(e.specie_rilevate || '—') + '</strong></div>' +
        (e.evidenze ? '<div class="meta">Evidenze: ' + App.esc(e.evidenze) + '</div>' : '') +
        (e.fonti_infestazione ? '<div class="meta">Fonti: ' + App.esc(e.fonti_infestazione) + '</div>' : '') +
        (locked ? '' : '<button class="btn small danger js-delev" data-id="' + e.id + '" style="margin-top:8px">Elimina</button>') +
      '</div>';
    }).join(''));
  }

  $app.on('click', '#btnAddEv', function () {
    const areaOpts = '<option value="">— Generale —</option>' + areas().map(function (a) {
      return '<option value="' + a.id + '">' + App.esc(a.nome) + ' (' + a.tipo + ')</option>';
    }).join('');
    App.modal({
      title: 'Nuova evidenza',
      bodyHtml:
        '<div class="field"><label>Area</label><select class="select" id="e_area">' + areaOpts + '</select></div>' +
        '<div class="field"><label>Specie rilevate</label><input class="input" id="e_specie" placeholder="es. Blatta, Topo"></div>' +
        '<div class="field"><label>Evidenze</label><input class="input" id="e_ev"></div>' +
        '<div class="field"><label>Fonti infestazione</label><input class="input" id="e_fonti"></div>',
      okText: 'Aggiungi',
      onOk: function (close, $bd) {
        const payload = {
          intervento_id: current.id,
          area_id: $bd.find('#e_area').val() || null,
          specie_rilevate: $bd.find('#e_specie').val().trim(),
          evidenze: $bd.find('#e_ev').val().trim(),
          fonti_infestazione: $bd.find('#e_fonti').val().trim(),
        };
        App.apiPost('/api/evidenze.php?action=save', payload).done(function () {
          close(); App.ok('Evidenza aggiunta'); reloadIntervento();
        }).fail(function (xhr) { App.err(App.errMsg(xhr)); });
      },
    });
  });

  $app.on('click', '.js-delev', function () {
    const id = $(this).data('id');
    App.apiPost('/api/evidenze.php?action=delete&id=' + id).done(function () {
      current.evidenze = current.evidenze.filter(function (e) { return e.id != id; });
      App.ok('Eliminata'); renderEvidenze();
    }).fail(function (xhr) { App.err(App.errMsg(xhr)); });
  });

  /* ---------- Tab Esito soglie ---------- */
  function renderEsito() {
    const s = current.soglie || [];
    if (!s.length) { $('#tabBody').html(App.emptyHtml('Nessun dato di soglia.', '📊')); return; }
    let html = '<div class="f-section"><h3>Esito soglie</h3>';
    s.forEach(function (g) {
      const sup = g.esito === 'superato';
      html += '<div class="esito-row">' +
        '<div><div style="font-weight:600">' + App.esc(g.area_nome) + ' · ' + App.esc(g.tipo_nome) + '</div>' +
        '<div class="muted" style="font-size:.82rem">' + g.con_attivita + '/' + g.totale + ' con attività · limite ' + g.limite + '</div></div>' +
        '<span class="badge ' + (sup ? 'red' : 'green') + '">' + (sup ? 'Limite superato' : 'Limite non superato') + '</span>' +
      '</div>';
    });
    html += '</div>';
    $('#tabBody').html(html);
  }

  /* ---------- Scanner QR -> salta agli input della postazione ---------- */
  function startScanner() {
    $('#scanner').addClass('open');
    qr = new Html5Qrcode('qrReader');
    qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: 240 }, onScan, function () {})
      .catch(function (e) { App.err('Fotocamera non disponibile: ' + e); stopScanner(); });
  }
  function stopScanner() {
    $('#scanner').removeClass('open');
    if (qr) { qr.stop().then(function () { qr.clear(); qr = null; }).catch(function () { qr = null; }); }
  }
  function onScan(text) {
    const code = text.trim();
    const local = current.postazioni.find(function (p) { return p.qr_code === code; });
    stopScanner();
    if (local) { jumpToPostazione(local.id); return; }
    App.apiGet('/api/postazioni.php?action=find_by_qr', { code: code }).done(function (res) {
      if (res.postazione.locale_id == current.locale_id) { reloadIntervento(); App.toast('Postazione ricaricata'); }
      else { App.err('Questa postazione non appartiene al locale dell\'intervento.'); }
    }).fail(function (xhr) { App.err(App.errMsg(xhr)); });
  }
  // Apre la tab Letture sull'area giusta e mette a fuoco gli input della postazione.
  function jumpToPostazione(pid) {
    const p = find(pid); if (!p) return;
    activeTab = 'letture';
    const idx = areas().findIndex(function (a) { return a.id === p.area_id; });
    areaIndex = idx < 0 ? 0 : idx;
    paintIntervento();
    setTimeout(function () {
      const $card = $('.pos-card[data-pid="' + pid + '"]');
      if ($card.length) {
        $card[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        $card.addClass('flash');
        $card.find('.r-val').trigger('focus');
        setTimeout(function () { $card.removeClass('flash'); }, 1600);
      }
    }, 80);
  }

  /* ---------- Report (valida -> genera -> invia) ---------- */
  function generateReport() {
    const doGenerate = function () {
      const $btn = $('#btnReport').prop('disabled', true).text('Generazione…');
      App.apiPost('/api/report.php?action=generate', { intervento_id: current.id }).done(function () {
        $btn.prop('disabled', false).text('Report');
        App.modal({
          title: 'Report pronto',
          bodyHtml: '<p>Il report PDF è stato generato.</p>' +
            '<p><a class="btn primary" style="width:100%" target="_blank" href="' + App.base + '/api/report.php?action=download&intervento_id=' + current.id + '">Scarica / Apri PDF</a></p>',
          okText: 'Invia al referente via email', cancelText: 'Chiudi',
          onOk: function (close) {
            App.apiPost('/api/report.php?action=send', { intervento_id: current.id }).done(function (r) {
              close(); App.ok(r.note || 'Report inviato'); reloadIntervento();
            }).fail(function (xhr) { App.err(App.errMsg(xhr)); });
          },
        });
      }).fail(function (xhr) { $btn.prop('disabled', false).text('Report'); App.err(App.errMsg(xhr)); });
    };

    if (current.stato === 'bozza') {
      App.confirm('Genera report', 'Ricordati di premere Salva prima. Validare l\'intervento e generare il report?', function () {
        App.apiPost('/api/interventi.php?action=validate&id=' + current.id).done(function () {
          current.stato = 'validato'; doGenerate();
        }).fail(function (xhr) { App.err(App.errMsg(xhr)); });
      }, 'Valida e genera');
    } else {
      doGenerate();
    }
  }

})(jQuery);
