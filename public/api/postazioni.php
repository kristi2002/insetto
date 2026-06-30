<?php
/**
 * public/api/postazioni.php — CRUD postazioni + lookup QR.
 *
 *   GET  ?action=list&locale_id=         (raggruppate per area)  [admin]
 *   GET  ?action=list&area_id=                                   [admin]
 *   GET  ?action=get&id=                                         [admin]
 *   POST ?action=create                                          [admin]
 *   PUT  ?action=update&id=                                      [admin]
 *   POST ?action=delete&id=                                      [admin]
 *   GET  ?action=find_by_qr&code=        (app tecnico)           [admin,tecnico]
 */

require_once __DIR__ . '/../../src/bootstrap.php';

$pdo = db();
$action = $_GET['action'] ?? 'list';

// La lookup QR e' consentita anche al tecnico in campo.
if ($action === 'find_by_qr') {
    require_role('admin', 'supervisore', 'tecnico');
} else {
    require_role('admin', 'supervisore');
}

switch ($action) {

    case 'list': {
        $localeId = (int) ($_GET['locale_id'] ?? 0);
        $areaId   = (int) ($_GET['area_id'] ?? 0);
        $sql = 'SELECT p.*, a.nome AS area_nome, a.tipo AS area_tipo,
                       td.nome AS tipo_nome, td.metrica
                FROM postazioni p
                JOIN aree a ON a.id = p.area_id
                JOIN tipi_dispositivo td ON td.id = p.tipo_dispositivo_id
                WHERE ';
        $args = [];
        if ($areaId) { $sql .= 'p.area_id = ?'; $args[] = $areaId; }
        else { $sql .= 'a.locale_id = ?'; $args[] = $localeId; }
        $sql .= ' ORDER BY a.tipo, a.nome, p.numero';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($args);
        json_ok(['postazioni' => $stmt->fetchAll()]);
        break;
    }

    case 'get': {
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare(
            'SELECT p.*, a.nome AS area_nome, a.tipo AS area_tipo, td.nome AS tipo_nome, td.metrica
             FROM postazioni p JOIN aree a ON a.id = p.area_id
             JOIN tipi_dispositivo td ON td.id = p.tipo_dispositivo_id WHERE p.id = ?'
        );
        $stmt->execute([$id]);
        $p = $stmt->fetch();
        if (!$p) { json_fail('Postazione non trovata', 404); }
        json_ok(['postazione' => $p]);
        break;
    }

    case 'find_by_qr': {
        $code = trim($_GET['code'] ?? '');
        if ($code === '') { json_fail('Codice mancante', 422); }
        $stmt = $pdo->prepare(
            'SELECT p.*, a.nome AS area_nome, a.tipo AS area_tipo, a.locale_id,
                    td.nome AS tipo_nome, td.metrica, l.nome AS locale_nome
             FROM postazioni p
             JOIN aree a ON a.id = p.area_id
             JOIN locali l ON l.id = a.locale_id
             JOIN tipi_dispositivo td ON td.id = p.tipo_dispositivo_id
             WHERE p.qr_code = ?'
        );
        $stmt->execute([$code]);
        $p = $stmt->fetch();
        if (!$p) { json_fail('Postazione non trovata per questo QR', 404); }
        json_ok(['postazione' => $p]);
        break;
    }

    case 'create': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $areaId = (int) ($in['area_id'] ?? 0);
        $tipoId = (int) ($in['tipo_dispositivo_id'] ?? 0);
        $numero = int_or_null(field($in, 'numero'));
        if (!$areaId || !$tipoId) { json_fail('Area e tipo dispositivo sono obbligatori', 422); }
        if ($numero === null) { json_fail('Il numero postazione è obbligatorio', 422); }

        $qr = unique_qr($pdo);
        $stmt = $pdo->prepare(
            'INSERT INTO postazioni (area_id, numero, ubicazione, tipo_dispositivo_id, qr_code, grado_rischio, attiva)
             VALUES (?,?,?,?,?,?,1)'
        );
        $stmt->execute([
            $areaId, $numero, field($in, 'ubicazione'), $tipoId, $qr,
            valid_grado(field($in, 'grado_rischio', 'minimo')),
        ]);
        json_ok(['id' => (int) $pdo->lastInsertId(), 'qr_code' => $qr]);
        break;
    }

    case 'update': {
        require_method('PUT');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $in = read_json_body();
        $numero = int_or_null(field($in, 'numero'));
        if ($numero === null) { json_fail('Il numero postazione è obbligatorio', 422); }
        $stmt = $pdo->prepare(
            'UPDATE postazioni SET numero=?, ubicazione=?, tipo_dispositivo_id=?, grado_rischio=?, attiva=? WHERE id=?'
        );
        $stmt->execute([
            $numero,
            field($in, 'ubicazione'),
            (int) ($in['tipo_dispositivo_id'] ?? 0),
            valid_grado(field($in, 'grado_rischio', 'minimo')),
            !empty($in['attiva']) ? 1 : 0,
            $id,
        ]);
        json_ok(['id' => $id]);
        break;
    }

    case 'delete': {
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $pdo->prepare('DELETE FROM postazioni WHERE id = ?')->execute([$id]);
        json_ok(['id' => $id]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}

/** Genera un qr_code univoco tipo "PST-xxxxxxxxxxxx". */
function unique_qr(PDO $pdo): string
{
    do {
        $code = 'PST-' . strtoupper(bin2hex(random_bytes(5)));
        $stmt = $pdo->prepare('SELECT 1 FROM postazioni WHERE qr_code = ?');
        $stmt->execute([$code]);
    } while ($stmt->fetch());
    return $code;
}

function valid_grado($g): string
{
    return in_array($g, ['minimo', 'medio', 'alto'], true) ? $g : 'minimo';
}
