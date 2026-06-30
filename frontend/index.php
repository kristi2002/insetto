<?php
require_once __DIR__ . '/../src/bootstrap.php';
$u = current_user();
if (!$u) { header('Location: ' . BASE_URL . '/login.php'); exit; }
// L'app in campo è per i tecnici (l'admin può accedervi per supervisione).
if ($u['ruolo'] === 'cliente') { header('Location: ' . BASE_URL . '/portale.php'); exit; }
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>App Tecnico · <?= e(APP_NAME) ?></title>
  <link rel="stylesheet" href="<?= e(BASE_URL) ?>/assets/css/app.css">
  <link rel="stylesheet" href="./assets/field.css">
</head>
<body class="field">
  <header class="f-header">
    <div class="f-title" id="fTitle">Interventi di oggi</div>
    <button class="f-back hidden" id="fBack">‹</button>
    <button class="btn small" id="fLogout">Esci</button>
  </header>

  <main id="fApp"><div class="loading"><div class="spinner"></div>Caricamento…</div></main>

  <!-- Overlay scanner QR -->
  <div class="scanner-overlay" id="scanner">
    <div class="scanner-head">
      <span>Inquadra il QR della postazione</span>
      <button class="btn small" id="scanClose">Chiudi</button>
    </div>
    <div id="qrReader"></div>
    <div class="scanner-hint">Oppure seleziona la postazione dalla lista.</div>
  </div>

  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
  <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
  <script>
    window.BASE_URL = <?= json_encode(BASE_URL) ?>;
    window.CURRENT_USER = <?= json_encode($u) ?>;
  </script>
  <script src="<?= e(BASE_URL) ?>/assets/js/core.js"></script>
  <script src="./assets/field.js"></script>
</body>
</html>
