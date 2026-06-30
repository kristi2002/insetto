<?php
/**
 * public/api/tipi_dispositivo.php — configurazione tipi dispositivo + soglie.
 *
 *   GET  ?action=list           [admin,tecnico]  (lettura per i form)
 *   POST ?action=create         [admin]          { nome, metrica, limite }
 *   PUT  ?action=update&id=     [admin]          { nome, metrica, limite }
 *   POST ?action=delete&id=     [admin]
 *
 * La soglia (limite) e' gestita 1:1 con il tipo dispositivo.
 */

require_once __DIR__ . '/../../src/bootstrap.php';

$pdo = db();
$action = $_GET['action'] ?? 'list';

if ($action === 'list') {
    require_role('admin', 'supervisore', 'tecnico');
} else {
    require_role('admin', 'supervisore');
}

switch ($action) {

    case 'list': {
        $stmt = $pdo->query(
            'SELECT td.*, COALESCE(s.limite, 1) AS limite
             FROM tipi_dispositivo td
             LEFT JOIN soglie s ON s.tipo_dispositivo_id = td.id
             ORDER BY td.nome'
        );
        json_ok(['tipi' => $stmt->fetchAll()]);
        break;
    }

    case 'get': {
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare(
            'SELECT td.*, COALESCE(s.limite, 1) AS limite
             FROM tipi_dispositivo td LEFT JOIN soglie s ON s.tipo_dispositivo_id = td.id
             WHERE td.id = ?'
        );
        $stmt->execute([$id]);
        $t = $stmt->fetch();
        if (!$t) { json_fail('Tipo non trovato', 404); }
        json_ok(['tipo' => $t]);
        break;
    }

    case 'create': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        if (field($in, 'nome', '') === '') { json_fail('Il nome è obbligatorio', 422); }
        $pdo->beginTransaction();
        $pdo->prepare('INSERT INTO tipi_dispositivo (nome, metrica) VALUES (?,?)')
            ->execute([field($in, 'nome'), valid_metrica(field($in, 'metrica'))]);
        $id = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO soglie (tipo_dispositivo_id, limite) VALUES (?,?)')
            ->execute([$id, max(0, (int) ($in['limite'] ?? 1))]);
        $pdo->commit();
        json_ok(['id' => $id]);
        break;
    }

    case 'update': {
        require_method('PUT');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $in = read_json_body();
        if (field($in, 'nome', '') === '') { json_fail('Il nome è obbligatorio', 422); }
        $pdo->beginTransaction();
        $pdo->prepare('UPDATE tipi_dispositivo SET nome=?, metrica=? WHERE id=?')
            ->execute([field($in, 'nome'), valid_metrica(field($in, 'metrica')), $id]);
        // upsert soglia
        $limite = max(0, (int) ($in['limite'] ?? 1));
        $stmt = $pdo->prepare('SELECT id FROM soglie WHERE tipo_dispositivo_id = ?');
        $stmt->execute([$id]);
        if ($stmt->fetch()) {
            $pdo->prepare('UPDATE soglie SET limite=? WHERE tipo_dispositivo_id=?')->execute([$limite, $id]);
        } else {
            $pdo->prepare('INSERT INTO soglie (tipo_dispositivo_id, limite) VALUES (?,?)')->execute([$id, $limite]);
        }
        $pdo->commit();
        json_ok(['id' => $id]);
        break;
    }

    case 'delete': {
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        // Blocca se in uso da postazioni.
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM postazioni WHERE tipo_dispositivo_id = ?');
        $stmt->execute([$id]);
        if ((int) $stmt->fetchColumn() > 0) {
            json_fail('Tipo dispositivo usato da alcune postazioni: non eliminabile', 409);
        }
        $pdo->prepare('DELETE FROM soglie WHERE tipo_dispositivo_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM tipi_dispositivo WHERE id = ?')->execute([$id]);
        json_ok(['id' => $id]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}

function valid_metrica($m): string
{
    return in_array($m, ['catture', 'consumo'], true) ? $m : 'catture';
}
