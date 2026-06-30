<?php
require_once __DIR__ . '/../src/bootstrap.php';
$u = current_user();
if (!$u) { header('Location: ' . BASE_URL . '/login.php'); exit; }
// Tecnici e clienti non accedono al gestionale: redirect alla loro home.
if ($u['ruolo'] === 'tecnico') { header('Location: ' . BASE_URL . '/../frontend/'); exit; }
if ($u['ruolo'] === 'cliente') { header('Location: ' . BASE_URL . '/portale.php'); exit; }

// Iniziali per l'avatar.
$parts = preg_split('/\s+/', trim($u['nome']));
$initials = strtoupper(mb_substr($parts[0] ?? '', 0, 1) . (count($parts) > 1 ? mb_substr(end($parts), 0, 1) : ''));

// Voci di navigazione: route, etichetta, icona SVG (feather-style).
$nav = [
  ['dashboard', 'Dashboard',
    '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'],
  ['clienti', 'Clienti',
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'],
  ['interventi', 'Interventi',
    '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'],
  // Magazzino / HACCP / Fatture: fuori scope v1, nascosti dalla nav (endpoint e viste restano disponibili).
  ['configurazione', 'Config.',
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'],
  ['utenti', 'Utenti',
    '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'],
];
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e(APP_NAME) ?></title>
  <link rel="stylesheet" href="<?= e(BASE_URL) ?>/assets/css/app.css">
</head>
<body class="has-rail">
  <aside class="rail">
    <nav class="rail-nav">
      <?php foreach ($nav as [$route, $label, $icon]): ?>
        <a class="rail-item" href="#/<?= $route ?>" data-route="<?= $route ?>">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><?= $icon ?></svg>
          <span class="rail-label"><?= e($label) ?></span>
          <?php if ($route === 'interventi'): ?>
            <span class="badge-dot hidden" id="badgeInterventi">0</span>
          <?php endif; ?>
        </a>
      <?php endforeach; ?>
    </nav>
    <div class="rail-bottom">
      <div class="rail-avatar" id="userAvatar" title="<?= e($u['nome']) ?> · <?= e($u['ruolo']) ?>"><?= e($initials ?: '?') ?></div>
    </div>
  </aside>
  <div class="rail-backdrop" id="railBackdrop"></div>

  <header class="topbar">
    <button class="hamburger-btn" id="menuToggle" aria-label="Menu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>
    <span class="topbar-logo" title="<?= e(APP_NAME) ?>">D</span>
    <div class="topbar-title" id="pageTitle">Clienti</div>
    <div class="topbar-right">
      <span class="topbar-date"><?= date('d/m/Y') ?></span>
      <button class="user-chip" id="headerUser" title="Account">
        <span class="avatar-sm"><?= e($initials ?: '?') ?></span>
        <span class="user-chip-text"><strong><?= e($u['nome']) ?></strong><span class="muted"><?= e($u['ruolo']) ?></span></span>
      </button>
    </div>
  </header>

  <main class="app-main">
    <div class="container" id="view"></div>
  </main>

  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script>window.BASE_URL = <?= json_encode(BASE_URL) ?>;</script>
  <script src="<?= e(BASE_URL) ?>/assets/js/core.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/clienti.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/locali.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/locale.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/interventi.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/configurazione.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/utenti.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/magazzino.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/dashboard.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/haccp.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/documenti.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/cliente-form.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/intervento-form.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/area-form.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/locale-form.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/utente-form.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/views/tipo-form.js"></script>
  <script>
    App.views = App.views || {};

    // Sotto-rotte che evidenziano una voce padre nella rail.
    const NAV_PARENT = {
      locali: 'clienti', locale: 'clienti', intervento: 'interventi',
      'clienti-form': 'clienti', 'area-form': 'clienti', 'intervento-form': 'interventi',
      'locale-form': 'clienti', 'utenti-form': 'utenti', 'tipo-form': 'configurazione',
    };
    const PAGE_TITLES = {
      dashboard: 'Dashboard', clienti: 'Clienti', interventi: 'Interventi',
      magazzino: 'Magazzino', haccp: 'HACCP / IPM', documenti: 'Fatturazione',
      configurazione: 'Configurazione', utenti: 'Utenti',
    };

    function router() {
      const hash = location.hash || '#/dashboard';
      const parts = hash.replace(/^#\//, '').split('/');
      const name = parts[0] || 'dashboard';
      const arg = parts[1] || null;
      const navName = NAV_PARENT[name] || name;
      $('.rail-item').removeClass('active').each(function () {
        if (this.getAttribute('data-route') === navName) $(this).addClass('active');
      });
      $('#pageTitle').text(PAGE_TITLES[navName] || '');
      const view = App.views[name] || App.views['dashboard'];
      $('#view').html(App.loadingHtml);
      view.render($('#view'), arg, parts.slice(1));
    }

    // Badge interventi in bozza (da completare).
    function refreshBadge() {
      App.apiGet('/api/interventi.php?action=list', { stato: 'bozza' }).done(function (res) {
        const n = (res.interventi || []).length;
        const $b = $('#badgeInterventi');
        if (n > 0) { $b.text(n > 9 ? '9+' : n).removeClass('hidden'); }
        else { $b.addClass('hidden'); }
      });
    }

    // Avatar / user chip -> menu account.
    function openAccount() {
      App.modal({
        title: 'Account',
        bodyHtml: '<p><strong><?= e($u['nome']) ?></strong><br><span class="muted"><?= e($u['email']) ?> · <?= e($u['ruolo']) ?></span></p>',
        okText: 'Esci', okClass: 'danger', cancelText: 'Chiudi',
        onOk: function (close) { close(); App.logout(); },
      });
    }
    $('#userAvatar, #headerUser').on('click', openAccount);

    App.loadSession().done(function () {
      $(window).on('hashchange', router);
      router();
      refreshBadge();
      setInterval(refreshBadge, 60000);

      // Gestione sidebar responsive
      $('#menuToggle').on('click', function (e) {
        e.stopPropagation();
        $('.rail').toggleClass('open');
        $('#railBackdrop').toggleClass('show');
      });
      $('#railBackdrop').on('click', function () {
        $('.rail').removeClass('open');
        $(this).removeClass('show');
      });
      $('.rail-item').on('click', function () {
        $('.rail').removeClass('open');
        $('#railBackdrop').removeClass('show');
      });
    });
  </script>
</body>
</html>
