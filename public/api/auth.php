<?php
/**
 * public/api/auth.php — endpoint autenticazione (JSON).
 *
 * Azioni (?action=):
 *   login   POST  { email, password }      -> imposta sessione, ritorna utente + redirect
 *   logout  POST                           -> distrugge sessione
 *   me      GET                            -> utente corrente + csrf token
 */

require_once __DIR__ . '/../../src/bootstrap.php';

$action = $_GET['action'] ?? '';

switch ($action) {

    case 'login':
        require_method('POST');
        $in = read_json_body();
        $email = field($in, 'email', '');
        $password = (string) ($in['password'] ?? '');

        if ($email === '' || $password === '') {
            json_fail('Email e password sono obbligatorie', 422);
        }

        $user = login($email, $password);
        if (!$user) {
            json_fail('Credenziali non valide', 401);
        }

        json_ok([
            'user'     => $user,
            'redirect' => home_for_role($user['ruolo']),
            'csrf'     => csrf_token(),
        ]);
        break;

    case 'logout':
        require_method('POST');
        logout();
        json_ok(['redirect' => BASE_URL . '/login.php']);
        break;

    case 'me':
        $u = current_user();
        json_ok([
            'user' => $u,
            'csrf' => $u ? csrf_token() : null,
        ]);
        break;

    default:
        json_fail('Azione non valida', 404);
}

/** Pagina iniziale in base al ruolo. */
function home_for_role(string $ruolo): string
{
    switch ($ruolo) {
        case 'tecnico':
            return BASE_URL . '/../frontend/';   // app in campo
        case 'cliente':
            return BASE_URL . '/portale.php';     // portale sola lettura
        case 'admin':
        default:
            return BASE_URL . '/index.php';       // gestionale
    }
}
