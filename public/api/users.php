<?php
/**
 * public/api/users.php — gestione utenti/ruoli. Solo admin.
 *
 *   GET  ?action=list[&ruolo=]
 *   POST ?action=create        { nome, email, password, ruolo, cliente_id? }
 *   PUT  ?action=update&id=     { nome, email, ruolo, cliente_id?, password? }
 *   POST ?action=toggle&id=
 *   POST ?action=delete&id=
 */

require_once __DIR__ . '/../../src/bootstrap.php';
$me = require_role('admin');
$pdo = db();
$action = $_GET['action'] ?? 'list';

switch ($action) {

    case 'list': {
        $ruolo = $_GET['ruolo'] ?? '';
        $sql = 'SELECT u.id, u.nome, u.email, u.ruolo, u.cliente_id, u.attivo, c.ragione_sociale AS cliente_nome
                FROM users u LEFT JOIN clienti c ON c.id = u.cliente_id WHERE 1=1';
        $args = [];
        if (in_array($ruolo, ['admin', 'tecnico', 'cliente'], true)) { $sql .= ' AND u.ruolo = ?'; $args[] = $ruolo; }
        $sql .= ' ORDER BY u.ruolo, u.nome';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($args);
        json_ok(['users' => $stmt->fetchAll()]);
        break;
    }

    case 'get': {
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT id, nome, email, ruolo, cliente_id, attivo FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $u = $stmt->fetch();
        if (!$u) { json_fail('Utente non trovato', 404); }
        json_ok(['user' => $u]);
        break;
    }

    case 'create': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $err = validate_user($pdo, $in, null);
        if ($err) { json_fail('Dati non validi', 422, ['fields' => $err]); }
        if (strlen((string) ($in['password'] ?? '')) < 6) {
            json_fail('Password troppo corta (min 6 caratteri)', 422, ['fields' => ['password' => 'Min 6 caratteri']]);
        }
        $stmt = $pdo->prepare(
            'INSERT INTO users (nome, email, password_hash, ruolo, cliente_id, attivo) VALUES (?,?,?,?,?,1)'
        );
        $stmt->execute([
            field($in, 'nome'),
            strtolower(field($in, 'email')),
            password_hash((string) $in['password'], PASSWORD_DEFAULT),
            valid_ruolo(field($in, 'ruolo')),
            field($in, 'ruolo') === 'cliente' ? int_or_null(field($in, 'cliente_id')) : null,
        ]);
        json_ok(['id' => (int) $pdo->lastInsertId()]);
        break;
    }

    case 'update': {
        require_method('PUT');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $in = read_json_body();
        $err = validate_user($pdo, $in, $id);
        if ($err) { json_fail('Dati non validi', 422, ['fields' => $err]); }
        $clienteId = field($in, 'ruolo') === 'cliente' ? int_or_null(field($in, 'cliente_id')) : null;
        $pdo->prepare('UPDATE users SET nome=?, email=?, ruolo=?, cliente_id=? WHERE id=?')
            ->execute([field($in, 'nome'), strtolower(field($in, 'email')), valid_ruolo(field($in, 'ruolo')), $clienteId, $id]);
        if (!empty($in['password'])) {
            if (strlen((string) $in['password']) < 6) { json_fail('Password troppo corta', 422); }
            $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')
                ->execute([password_hash((string) $in['password'], PASSWORD_DEFAULT), $id]);
        }
        json_ok(['id' => $id]);
        break;
    }

    case 'toggle': {
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        if ($id === (int) $me['id']) { json_fail('Non puoi disattivare te stesso', 409); }
        $pdo->prepare('UPDATE users SET attivo = 1 - attivo WHERE id = ?')->execute([$id]);
        json_ok(['id' => $id]);
        break;
    }

    case 'delete': {
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        if ($id === (int) $me['id']) { json_fail('Non puoi eliminare te stesso', 409); }
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        json_ok(['id' => $id]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}

function valid_ruolo($r): string
{
    return in_array($r, ['admin', 'tecnico', 'cliente'], true) ? $r : 'tecnico';
}

function validate_user(PDO $pdo, array $in, ?int $excludeId): array
{
    $err = [];
    if (field($in, 'nome', '') === '') { $err['nome'] = 'Nome obbligatorio'; }
    $email = strtolower(field($in, 'email', ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $err['email'] = 'Email non valida';
    } else {
        $sql = 'SELECT id FROM users WHERE email = ?';
        $args = [$email];
        if ($excludeId) { $sql .= ' AND id <> ?'; $args[] = $excludeId; }
        $stmt = $pdo->prepare($sql); $stmt->execute($args);
        if ($stmt->fetch()) { $err['email'] = 'Email già in uso'; }
    }
    if (field($in, 'ruolo') === 'cliente' && !int_or_null(field($in, 'cliente_id'))) {
        $err['cliente_id'] = 'Per il ruolo cliente serve il cliente associato';
    }
    return $err;
}
