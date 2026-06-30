<?php
/**
 * public/api/locali.php — CRUD locali (ex "siti"). Solo admin.
 *
 *   GET  ?action=list&cliente_id=
 *   GET  ?action=get&id=
 *   POST ?action=create
 *   PUT  ?action=update&id=
 *   POST ?action=delete&id=
 */

require_once __DIR__ . '/../../src/bootstrap.php';
require_role('admin', 'supervisore');

$pdo = db();
$action = $_GET['action'] ?? 'list';

switch ($action) {

    case 'all': {
        // Tutti i locali (per il filtro nella lista clienti).
        $stmt = $pdo->query(
            'SELECT l.id, l.nome, c.ragione_sociale AS cliente_nome
             FROM locali l JOIN clienti c ON c.id = l.cliente_id
             ORDER BY c.ragione_sociale, l.nome'
        );
        json_ok(['locali' => $stmt->fetchAll()]);
        break;
    }

    case 'list': {
        $clienteId = (int) ($_GET['cliente_id'] ?? 0);
        $stmt = $pdo->prepare(
            'SELECT l.*,
                    (SELECT COUNT(*) FROM aree a WHERE a.locale_id = l.id) AS num_aree,
                    (SELECT COUNT(*) FROM postazioni p JOIN aree a ON p.area_id = a.id WHERE a.locale_id = l.id) AS num_postazioni
             FROM locali l WHERE l.cliente_id = ? ORDER BY l.nome'
        );
        $stmt->execute([$clienteId]);
        json_ok(['locali' => $stmt->fetchAll()]);
        break;
    }

    case 'get': {
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare(
            'SELECT l.*, c.ragione_sociale AS cliente_nome
             FROM locali l JOIN clienti c ON c.id = l.cliente_id WHERE l.id = ?'
        );
        $stmt->execute([$id]);
        $locale = $stmt->fetch();
        if (!$locale) { json_fail('Locale non trovato', 404); }
        json_ok(['locale' => $locale]);
        break;
    }

    case 'create': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $clienteId = (int) ($in['cliente_id'] ?? 0);
        if (!$clienteId) { json_fail('Cliente mancante', 422); }
        if (field($in, 'nome', '') === '') { json_fail('Il nome del locale è obbligatorio', 422); }
        $stmt = $pdo->prepare(
            'INSERT INTO locali (cliente_id, nome, indirizzo, frequenza_servizio, stato, foto_path)
             VALUES (?,?,?,?,?,?)'
        );
        $stmt->execute([
            $clienteId,
            field($in, 'nome'),
            field($in, 'indirizzo'),
            field($in, 'frequenza_servizio'),
            valid_stato(field($in, 'stato', 'attivo')),
            field($in, 'foto_path'),
        ]);
        json_ok(['id' => (int) $pdo->lastInsertId()]);
        break;
    }

    case 'update': {
        require_method('PUT');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $in = read_json_body();
        if (field($in, 'nome', '') === '') { json_fail('Il nome del locale è obbligatorio', 422); }
        $stmt = $pdo->prepare(
            'UPDATE locali SET nome=?, indirizzo=?, frequenza_servizio=?, stato=?, foto_path=? WHERE id=?'
        );
        $stmt->execute([
            field($in, 'nome'),
            field($in, 'indirizzo'),
            field($in, 'frequenza_servizio'),
            valid_stato(field($in, 'stato', 'attivo')),
            field($in, 'foto_path'),
            $id,
        ]);
        json_ok(['id' => $id]);
        break;
    }

    case 'delete': {
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $pdo->prepare('DELETE FROM locali WHERE id = ?')->execute([$id]);
        json_ok(['id' => $id]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}

function valid_stato($s): string
{
    return in_array($s, ['attivo', 'inattivo', 'archiviato'], true) ? $s : 'attivo';
}
