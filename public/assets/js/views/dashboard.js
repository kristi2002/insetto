/* dashboard.js — KPI con grafici (Chart.js) e fallback CSS.
   Grafici: trend infestazioni (linea), interventi per tecnico (barre),
   interventi per area (ciambella). */
(function ($) {
  'use strict';
  App.views = App.views || {};

  const HAS_CHART = typeof Chart !== 'undefined';
  const COL = {
    green: '#1f9d55', greenDark: '#18794a', greenSoft: 'rgba(31,157,85,.14)',
    muted: '#6b7785', border: '#e2e8f0',
  };
  // Palette per la ciambella (verdi + neutri coerenti col tema).
  const PIE = ['#1f9d55', '#18794a', '#7bc89b', '#b7791f', '#1c5fb0', '#d64545', '#9fb3c8', '#3fae74'];

  let charts = [];   // istanze Chart attive (da distruggere al ridisegno)
  function destroyCharts() { charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); charts = []; }

  function render($view) {
    destroyCharts();
    $view.html('<div class="page-head"><div><h1>Dashboard</h1><div class="sub">Indicatori chiave</div></div></div>' + App.loadingHtml);
    App.apiGet('/api/dashboard.php?action=overview').done(function (d) {
      paint($view, d);
    }).fail(function (xhr) { $view.html(App.emptyHtml(App.errMsg(xhr), '⚠️')); });
  }

  function statCard(label, value, accent) {
    return '<div class="stat ' + (accent || '') + '"><div class="stat-val">' + value + '</div><div class="stat-lbl">' + App.esc(label) + '</div></div>';
  }

  /* Fallback CSS: barre orizzontali quando Chart.js non e' disponibile. */
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
  function trendBarsCss(trend) {
    if (!trend.length) return '<div class="muted">Nessun dato di trend.</div>';
    const max = Math.max.apply(null, trend.map(function (t) { return +t.catture; })) || 1;
    return '<div class="trend">' + trend.map(function (t) {
      const h = Math.round((+t.catture / max) * 100);
      return '<div class="trend-col" title="' + t.mese + ': ' + t.catture + ' catture, ' + t.interventi + ' interventi">' +
        '<div class="trend-bar" style="height:' + Math.max(3, h) + '%"></div>' +
        '<div class="trend-x">' + App.esc(t.mese.slice(5)) + '</div></div>';
    }).join('') + '</div>';
  }

  function chartBox(id, height) {
    return '<div style="position:relative;height:' + (height || 240) + 'px"><canvas id="' + id + '"></canvas></div>';
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

    // Trend (linea) a tutta larghezza
    html += '<div class="card" style="margin-top:16px"><h3 style="margin-top:0">Trend infestazioni (catture per mese)</h3>' +
      (HAS_CHART && d.trend.length ? chartBox('chTrend', 260) : trendBarsCss(d.trend)) + '</div>';

    // Due colonne: per tecnico (barre) / per area (ciambella)
    html += '<div class="dash-2col" style="margin-top:16px">' +
      '<div class="card"><h3 style="margin-top:0">Interventi per tecnico</h3>' +
        (HAS_CHART && d.per_tecnico.length ? chartBox('chTec', 240) : barList(d.per_tecnico, 'tecnico', 'n')) + '</div>' +
      '<div class="card"><h3 style="margin-top:0">Interventi per area</h3>' +
        (HAS_CHART && d.per_area.length ? chartBox('chArea', 240) : barList(d.per_area, 'area', 'n', 'tipo')) + '</div>' +
    '</div>';

    // Postazioni oltre soglia (tabella a card su mobile)
    html += '<div class="card" style="margin-top:16px"><h3 style="margin-top:0">Postazioni/aree oltre soglia</h3>';
    if (!d.dettaglio_soglie.length) { html += '<div class="muted">Nessun superamento registrato.</div>'; }
    else {
      html += '<div class="table-wrap"><table class="data stack"><thead><tr><th>Data</th><th>Cliente</th><th>Locale</th><th>Area</th><th>Dispositivo</th><th>Attività/Limite</th></tr></thead><tbody>' +
        d.dettaglio_soglie.map(function (r) {
          return '<tr><td data-label="Data">' + App.esc(r.data) + '</td><td data-label="Cliente">' + App.esc(r.cliente_nome) + '</td><td data-label="Locale">' + App.esc(r.locale_nome) +
            '</td><td data-label="Area">' + App.esc(r.area_nome || '—') + '</td><td data-label="Dispositivo">' + App.esc(r.tipo_nome || '—') +
            '</td><td data-label="Attività/Limite"><span class="badge red">' + r.con_attivita + ' / ' + r.limite + '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    html += '</div>';

    $view.html(html);
    if (HAS_CHART) drawCharts(d);
  }

  function drawCharts(d) {
    destroyCharts();
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    Chart.defaults.color = COL.muted;

    // Trend: linea catture + interventi
    const elT = document.getElementById('chTrend');
    if (elT && d.trend.length) {
      charts.push(new Chart(elT, {
        type: 'line',
        data: {
          labels: d.trend.map(function (t) { return t.mese.slice(5); }),
          datasets: [
            { label: 'Catture', data: d.trend.map(function (t) { return +t.catture; }),
              borderColor: COL.green, backgroundColor: COL.greenSoft, fill: true, tension: .35, borderWidth: 2, pointRadius: 3 },
            { label: 'Interventi', data: d.trend.map(function (t) { return +t.interventi; }),
              borderColor: COL.muted, backgroundColor: 'transparent', borderDash: [5, 4], tension: .35, borderWidth: 2, pointRadius: 0 },
          ],
        },
        options: baseOpts({ legend: true, yBegin: true }),
      }));
    }

    // Per tecnico: barre
    const elTec = document.getElementById('chTec');
    if (elTec && d.per_tecnico.length) {
      charts.push(new Chart(elTec, {
        type: 'bar',
        data: {
          labels: d.per_tecnico.map(function (i) { return i.tecnico; }),
          datasets: [{ label: 'Interventi', data: d.per_tecnico.map(function (i) { return +i.n; }),
            backgroundColor: COL.green, borderRadius: 6, maxBarThickness: 46 }],
        },
        options: baseOpts({ legend: false, yBegin: true }),
      }));
    }

    // Per area: ciambella
    const elA = document.getElementById('chArea');
    if (elA && d.per_area.length) {
      const top = d.per_area.slice(0, 8);
      charts.push(new Chart(elA, {
        type: 'doughnut',
        data: {
          labels: top.map(function (i) { return i.area + (i.tipo ? ' (' + i.tipo + ')' : ''); }),
          datasets: [{ data: top.map(function (i) { return +i.n; }), backgroundColor: PIE, borderWidth: 2, borderColor: '#fff' }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
          cutout: '58%',
        },
      }));
    }
  }

  function baseOpts(o) {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: !!o.legend, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: !!o.yBegin, grid: { color: COL.border }, ticks: { precision: 0, font: { size: 11 } } },
      },
    };
  }

  App.views['dashboard'] = { render: render };
})(jQuery);
