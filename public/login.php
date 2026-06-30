<?php
require_once __DIR__ . '/../src/bootstrap.php';
// Se gia' loggato, manda alla home del ruolo.
$u = current_user();
if ($u) {
    $map = ['tecnico' => '/../frontend/', 'cliente' => '/portale.php', 'admin' => '/index.php'];
    header('Location: ' . BASE_URL . ($map[$u['ruolo']] ?? '/index.php'));
    exit;
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>Accedi · <?= e(APP_NAME) ?></title>
  <link rel="stylesheet" href="<?= e(BASE_URL) ?>/assets/css/app.css">
</head>
<body>
  <div class="login-wrap">
    <form class="login-card" id="loginForm" autocomplete="on">
      <div class="logo-lg">D</div>
      <h1><?= e(APP_NAME) ?></h1>
      <div class="sub">Accedi al gestionale</div>
      <div class="err" id="loginErr"></div>
      <div class="field">
        <label for="email">Email</label>
        <input class="input" type="email" id="email" name="email" required autofocus>
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input class="input" type="password" id="password" name="password" required>
      </div>
      <button class="btn primary" type="submit" id="loginBtn" style="width:100%">Accedi</button>
    </form>
  </div>

  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
  <script>window.BASE_URL = <?= json_encode(BASE_URL) ?>;</script>
  <script src="<?= e(BASE_URL) ?>/assets/js/core.js"></script>
  <script>
    $('#loginForm').on('submit', function (ev) {
      ev.preventDefault();
      const $err = $('#loginErr').removeClass('show');
      const $btn = $('#loginBtn').prop('disabled', true).text('Accesso…');
      App.apiPost('/api/auth.php?action=login', {
        email: $('#email').val(),
        password: $('#password').val(),
      }).done(function (res) {
        window.location.href = res.redirect;
      }).fail(function (xhr) {
        $err.text(App.errMsg(xhr)).addClass('show');
        $btn.prop('disabled', false).text('Accedi');
      });
    });
  </script>
</body>
</html>
