<?php
/**
 * src/auth.php — sessioni, login, ruoli, CSRF.
 *
 * Dipende da db() (src/db.php) e dagli helper JSON (src/helpers.php),
 * caricati da src/bootstrap.php.
 */

/** Avvia la sessione con cookie sicuri (idempotente). */
function auth_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'path'     => '/',
    ]);
    session_start();
}

/** Restituisce (e genera al primo uso) il token CSRF di sessione. */
function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/** Verifica il token CSRF su richieste che modificano dati; fallisce con 419. */
function verify_csrf(): void
{
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
    if (!is_string($sent) || $sent === '' || !hash_equals($_SESSION['csrf_token'] ?? '', $sent)) {
        json_fail('Token CSRF non valido o assente', 419);
    }
}

/** Utente corrente (array) o null. */
function current_user(): ?array
{
    return $_SESSION['user'] ?? null;
}

/** Richiede un utente autenticato; restituisce l'utente o risponde 401. */
function require_login(): array
{
    $u = current_user();
    if (!$u) {
        json_fail('Non autenticato', 401);
    }
    return $u;
}

/** Richiede uno dei ruoli indicati; risponde 403 se non autorizzato. */
function require_role(string ...$roles): array
{
    $u = require_login();
    if (!in_array($u['ruolo'], $roles, true)) {
        json_fail('Permesso negato', 403);
    }
    return $u;
}

/**
 * Tenta il login. In caso di successo popola la sessione e restituisce
 * l'utente (senza hash), altrimenti null.
 */
function login(string $email, string $password): ?array
{
    $stmt = db()->prepare('SELECT * FROM users WHERE email = ? AND attivo = 1 LIMIT 1');
    $stmt->execute([$email]);
    $u = $stmt->fetch();

    if (!$u || !password_verify($password, $u['password_hash'])) {
        return null;
    }

    // Previene session fixation.
    session_regenerate_id(true);

    $_SESSION['user'] = [
        'id'         => (int) $u['id'],
        'nome'       => $u['nome'],
        'email'      => $u['email'],
        'ruolo'      => $u['ruolo'],
        'cliente_id' => $u['cliente_id'] !== null ? (int) $u['cliente_id'] : null,
    ];

    return $_SESSION['user'];
}

/** Distrugge la sessione utente. */
function logout(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}
