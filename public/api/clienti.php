<?php
/**
 * public/api/clienti.php — CRUD clienti (JSON). Solo ruolo admin.
 *
 * Azioni:
 *   GET  ?action=list[&q=&stato=]
 *   GET  ?action=get&id=
 *   POST ?action=create
 *   PUT  ?action=update&id=
 *   POST ?action=archive&id=        (stato -> archiviato)
 *   POST ?action=delete&id=         (eliminazione definitiva)
 */

require_once __DIR__ . '/../../src/bootstrap.php';
require_role('admin', 'supervisore');

$pdo = db();
$action = $_GET['action'] ?? 'list';

switch ($action) {

    case 'list': {
        $q     = trim($_GET['q'] ?? '');
        $stato = trim($_GET['stato'] ?? '');
        $sql = 'SELECT c.*, (SELECT COUNT(*) FROM locali l WHERE l.cliente_id = c.id) AS num_locali
                FROM clienti c WHERE 1=1';
        $args = [];
        if ($q !== '') {
            $sql .= ' AND (c.ragione_sociale LIKE ? OR c.partita_iva LIKE ? OR c.email LIKE ?)';
            $like = '%' . $q . '%';
            array_push($args, $like, $like, $like);
        }
        if (in_array($stato, ['attivo', 'inattivo', 'archiviato'], true)) {
            $sql .= ' AND c.stato = ?';
            $args[] = $stato;
        }
        // Filtro per locale specifico
        if (!empty($_GET['locale_id'])) {
            $sql .= ' AND EXISTS (SELECT 1 FROM locali l WHERE l.cliente_id = c.id AND l.id = ?)';
            $args[] = (int) $_GET['locale_id'];
        }
        // Filtro per frequenza di servizio di almeno un locale
        if (!empty($_GET['frequenza'])) {
            $sql .= ' AND EXISTS (SELECT 1 FROM locali l WHERE l.cliente_id = c.id AND l.frequenza_servizio = ?)';
            $args[] = trim($_GET['frequenza']);
        }
        $sql .= ' ORDER BY c.ragione_sociale ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($args);
        json_ok(['clienti' => $stmt->fetchAll()]);
        break;
    }

    case 'get': {
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT * FROM clienti WHERE id = ?');
        $stmt->execute([$id]);
        $cliente = $stmt->fetch();
        if (!$cliente) {
            json_fail('Cliente non trovato', 404);
        }
        $stmt = $pdo->prepare('SELECT * FROM locali WHERE cliente_id = ? ORDER BY nome');
        $stmt->execute([$id]);
        $cliente['locali'] = $stmt->fetchAll();
        json_ok(['cliente' => $cliente]);
        break;
    }

    case 'create': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $errors = validate_cliente($in);
        if ($errors) {
            json_fail('Dati non validi', 422, ['fields' => $errors]);
        }
        $stmt = $pdo->prepare(
            'INSERT INTO clienti
               (ragione_sociale, partita_iva, sede_legale, riferimento_aziendale, email, telefono, note_interne, stato)
             VALUES (?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            field($in, 'ragione_sociale'),
            field($in, 'partita_iva'),
            field($in, 'sede_legale'),
            field($in, 'riferimento_aziendale'),
            field($in, 'email'),
            field($in, 'telefono'),
            field($in, 'note_interne'),
            valid_stato(field($in, 'stato', 'attivo')),
        ]);
        json_ok(['id' => (int) $pdo->lastInsertId()]);
        break;
    }

    case 'update': {
        require_method('PUT');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $in = read_json_body();
        $errors = validate_cliente($in);
        if ($errors) {
            json_fail('Dati non validi', 422, ['fields' => $errors]);
        }
        $stmt = $pdo->prepare(
            'UPDATE clienti SET
               ragione_sociale=?, partita_iva=?, sede_legale=?, riferimento_aziendale=?,
               email=?, telefono=?, note_interne=?, stato=?
             WHERE id=?'
        );
        $stmt->execute([
            field($in, 'ragione_sociale'),
            field($in, 'partita_iva'),
            field($in, 'sede_legale'),
            field($in, 'riferimento_aziendale'),
            field($in, 'email'),
            field($in, 'telefono'),
            field($in, 'note_interne'),
            valid_stato(field($in, 'stato', 'attivo')),
            $id,
        ]);
        json_ok(['id' => $id]);
        break;
    }

    case 'archive': {
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $pdo->prepare('UPDATE clienti SET stato = ? WHERE id = ?')->execute(['archiviato', $id]);
        json_ok(['id' => $id]);
        break;
    }

    case 'delete': {
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $pdo->prepare('DELETE FROM clienti WHERE id = ?')->execute([$id]);
        json_ok(['id' => $id]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}

/* ---------- Validazione ---------- */
function validate_cliente(array $in): array
{
    $err = [];
    if (field($in, 'ragione_sociale', '') === '') {
        $err['ragione_sociale'] = 'La ragione sociale è obbligatoria';
    }
    $email = field($in, 'email', '');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $err['email'] = 'Email non valida';
    }
    return $err;
}

function valid_stato($s): string
{
    return in_array($s, ['attivo', 'inattivo', 'archiviato'], true) ? $s : 'attivo';
}
