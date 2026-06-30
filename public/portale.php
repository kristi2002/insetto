<?php
require_once __DIR__ . '/../src/bootstrap.php';
$u = current_user();
if (!$u) { header('Location: ' . BASE_URL . '/login.php'); exit; }
// Portale riservato ai clienti; admin/tecnico vanno alle proprie aree.
if ($u['ruolo'] === 'admin')   { header('Location: ' . BASE_URL . '/index.php'); exit; }
if ($u['ruolo'] === 'tecnico') { header('Location: ' . BASE_URL . '/../frontend/'); exit; }
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Portale Cliente · <?= e(APP_NAME) ?></title>
  <link rel="stylesheet" href="<?= e(BASE_URL) ?>/assets/css/app.css">
</head>
<body>
  <header class="app-header">
    <div class="brand"><span class="logo">D</span> Portale Cliente</div>
    <nav><a href="#/home" class="active">Riepilogo</a></nav>
    <div class="user-box">
      <div class="who"><strong><?= e($u['nome']) ?></strong></div>
      <button class="btn small" id="logoutBtn">Esci</button>
    </div>
  </header>
  <main class="container" id="view"></main>

  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
  <script>window.BASE_URL = <?= json_encode(BASE_URL) ?>;</script>
  <script src="<?= e(BASE_URL) ?>/assets/js/core.js"></script>
  <script src="<?= e(BASE_URL) ?>/assets/js/portale.js"></script>
</body>
</html>
