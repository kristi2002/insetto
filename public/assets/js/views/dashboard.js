/* dashboard.js — KPI: interventi per area/tecnico, soglie superate, trend. */
(function ($) {
  'use strict';
  App.views = App.views || {};

  function render($view) {
    $view.html('<div class="page-head"><div><h1>Dashboard</h1><div class="sub">Indicatori chiave</div></div></div>' + App.loadingHtml);
    App.apiGet('/api/dashboard.php?action=overview').done(function (d) {
      paint($view, d);
    }).fail(function (xhr) { $view.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  function statCard(label, value, accent) {
    return '<div class="stat ' + (accent || '') + '"><div class="stat-val">' + value + '</div><div class="stat-lbl">' + App.esc(label) + '</div></div>';
  }

  function barList(items, labelKey, valKey, extra) {
    if (!items.length) return '<div class="muted">Nessun dato.</div>';
    const max = Math.max.apply(null, items.map(function (i) { return +i[valKey]; })) || 1;
    return items.map(function (i) {
      const pct = Math.round((+i[valKey] / max) * 100);
      const lbl = App.esc(i[labelKey]) + (extra && i[extra] ? ' <span class="muted">(' + App.esc(i[extra]) + ')</span>' : '');
      return '<div class="bar-row"><div class="bar-lbl">' + lbl + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="bar-val">' + i[valKey] + '</div></div>';
    }).join('');
  }

  function paint($view, d) {
    const c = d.counters;
    let html = '<div class="page-head"><div><h1>Dashboard</h1><div class="sub">Indicatori chiave</div></div></div>';

    // Contatori
    html += '<div class="stat-grid">' +
      statCard('Clienti', c.clienti) +
      statCard('Locali', c.locali) +
      statCard('Postazioni', c.postazioni) +
      statCard('Interventi', c.interventi) +
      statCard('Soglie superate', d.soglie_superate, d.soglie_superate > 0 ? 'danger' : 'ok') +
      statCard('Da riordinare', c.alert_riordino, c.alert_riordino > 0 ? 'warn' : 'ok') +
    '</div>';

    // Due colonne: per tecnico / per area
    html += '<div class="dash-2col">' +
      '<div class="card"><h3 style="margin-top:0">Interventi per tecnico</h3>' + barList(d.per_tecnico, 'tecnico', 'n') + '</div>' +
      '<div class="card"><h3 style="margin-top:0">Interventi per area</h3>' + barList(d.per_area, 'area', 'n', 'tipo') + '</div>' +
    '</div>';

    // Trend infestazioni
    html += '<div class="card" style="margin-top:16px"><h3 style="margin-top:0">Trend infestazioni (catture per mese)</h3>' + trendChart(d.trend) + '</div>';

    // Postazioni oltre soglia
    html += '<div class="card" style="margin-top:16px"><h3 style="margin-top:0">Postazioni/aree oltre soglia</h3>';
    if (!d.dettaglio_soglie.length) { html += '<div class="muted">Nessun superamento registrato.</div>'; }
    else {
      html += '<div class="table-wrap"><table class="data"><thead><tr><th>Data</th><th>Cliente</th><th>Locale</th><th>Area</th><th>Dispositivo</th><th>Attività/Limite</th></tr></thead><tbody>' +
        d.dettaglio_soglie.map(function (r) {
          return '<tr><td>' + App.esc(r.data) + '</td><td>' + App.esc(r.cliente_nome) + '</td><td>' + App.esc(r.locale_nome) +
            '</td><td>' + App.esc(r.area_nome || '—') + '</td><td>' + App.esc(r.tipo_nome || '—') +
            '</td><td><span class="badge red">' + r.con_attivita + ' / ' + r.limite + '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    html += '</div>';

    $view.html(html);
  }

  function trendChart(trend) {
    if (!trend.length) return '<div class="muted">Nessun dato di trend.</div>';
    const max = Math.max.apply(null, trend.map(function (t) { return +t.catture; })) || 1;
    return '<div class="trend">' + trend.map(function (t) {
      const h = Math.round((+t.catture / max) * 100);
      return '<div class="trend-col" title="' + t.mese + ': ' + t.catture + ' catture, ' + t.interventi + ' interventi">' +
        '<div class="trend-bar" style="height:' + Math.max(3, h) + '%"></div>' +
        '<div class="trend-x">' + App.esc(t.mese.slice(5)) + '</div></div>';
    }).join('') + '</div>';
  }

  App.views['dashboard'] = { render: render };
})(jQuery);
