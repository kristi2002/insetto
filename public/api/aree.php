<?php
/**
 * public/api/aree.php — CRUD aree di un locale. Solo admin.
 *
 *   GET  ?action=list&locale_id=
 *   POST ?action=create        { locale_id, nome, tipo }
 *   PUT  ?action=update&id=     { nome, tipo }
 *   POST ?action=delete&id=
 */

require_once __DIR__ . '/../../src/bootstrap.php';
require_role('admin', 'supervisore');

$pdo = db();
$action = $_GET['action'] ?? 'list';

switch ($action) {

    case 'list': {
        $localeId = (int) ($_GET['locale_id'] ?? 0);
        $stmt = $pdo->prepare(
            'SELECT a.*, (SELECT COUNT(*) FROM postazioni p WHERE p.area_id = a.id) AS num_postazioni
             FROM aree a WHERE a.locale_id = ? ORDER BY a.tipo, a.nome'
        );
        $stmt->execute([$localeId]);
        json_ok(['aree' => $stmt->fetchAll()]);
        break;
    }

    case 'get': {
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT * FROM aree WHERE id = ?');
        $stmt->execute([$id]);
        $a = $stmt->fetch();
        if (!$a) { json_fail('Area non trovata', 404); }
        json_ok(['area' => $a]);
        break;
    }

    case 'create': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $localeId = (int) ($in['locale_id'] ?? 0);
        if (!$localeId) { json_fail('Locale mancante', 422); }
        if (field($in, 'nome', '') === '') { json_fail('Il nome area è obbligatorio', 422); }

        $interventoId = isset($in['intervento_id']) ? (int) $in['intervento_id'] : 0;
        if (!$interventoId) { json_fail('Intervento mancante', 422); }

        // Server-side validation that the selected intervento belongs to this locale
        $valStmt = $pdo->prepare('SELECT locale_id FROM interventi WHERE id = ?');
        $valStmt->execute([$interventoId]);
        $intLocaleId = $valStmt->fetchColumn();
        if (!$intLocaleId || (int)$intLocaleId !== $localeId) {
            json_fail('L\'intervento selezionato non appartiene a questo locale', 422);
        }

        $stmt = $pdo->prepare('INSERT INTO aree (locale_id, nome, tipo, intervento_id) VALUES (?,?,?,?)');
        $stmt->execute([$localeId, field($in, 'nome'), valid_tipo(field($in, 'tipo')), $interventoId]);
        json_ok(['id' => (int) $pdo->lastInsertId()]);
        break;
    }

    case 'update': {
        require_method('PUT');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $in = read_json_body();
        if (field($in, 'nome', '') === '') { json_fail('Il nome area è obbligatorio', 422); }
        $pdo->prepare('UPDATE aree SET nome=?, tipo=? WHERE id=?')
            ->execute([field($in, 'nome'), valid_tipo(field($in, 'tipo')), $id]);
        json_ok(['id' => $id]);
        break;
    }

    case 'delete': {
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $pdo->prepare('DELETE FROM aree WHERE id = ?')->execute([$id]);
        json_ok(['id' => $id]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}

function valid_tipo($t): string
{
    return in_array($t, ['interna', 'esterna'], true) ? $t : 'interna';
}
