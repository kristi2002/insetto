<?php
/**
 * public/api/evidenze.php — situazione evidenze (specie, fonti) di un intervento.
 *
 *   POST ?action=save     { intervento_id, area_id?, specie_rilevate, evidenze, fonti_infestazione }
 *   POST ?action=delete&id=
 *
 * Accesso: admin oppure tecnico assegnato all'intervento.
 */

require_once __DIR__ . '/../../src/bootstrap.php';

$pdo = db();
$user = require_login();
$action = $_GET['action'] ?? '';

if ($user['ruolo'] === 'cliente') { json_fail('Permesso negato', 403); }

/** Verifica che l'utente possa scrivere sull'intervento. */
function assert_can_write(PDO $pdo, int $interventoId, array $user): void
{
    $stmt = $pdo->prepare('SELECT tecnico_id, stato FROM interventi WHERE id = ?');
    $stmt->execute([$interventoId]);
    $i = $stmt->fetch();
    if (!$i) { json_fail('Intervento non trovato', 404); }
    if ($user['ruolo'] === 'tecnico' && (int) $i['tecnico_id'] !== (int) $user['id']) {
        json_fail('Permesso negato', 403);
    }
    if ($i['stato'] === 'inviato') { json_fail('Intervento già inviato', 409); }
}

switch ($action) {

    case 'save': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $interventoId = (int) ($in['intervento_id'] ?? 0);
        if (!$interventoId) { json_fail('Intervento mancante', 422); }
        assert_can_write($pdo, $interventoId, $user);

        $pdo->prepare(
            'INSERT INTO evidenze (intervento_id, area_id, specie_rilevate, evidenze, fonti_infestazione)
             VALUES (?,?,?,?,?)'
        )->execute([
            $interventoId,
            int_or_null(field($in, 'area_id')),
            field($in, 'specie_rilevate'),
            field($in, 'evidenze'),
            field($in, 'fonti_infestazione'),
        ]);
        json_ok(['id' => (int) $pdo->lastInsertId()]);
        break;
    }

    case 'delete': {
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT intervento_id FROM evidenze WHERE id = ?');
        $stmt->execute([$id]);
        $ev = $stmt->fetch();
        if (!$ev) { json_fail('Evidenza non trovata', 404); }
        assert_can_write($pdo, (int) $ev['intervento_id'], $user);
        $pdo->prepare('DELETE FROM evidenze WHERE id = ?')->execute([$id]);
        json_ok(['id' => $id]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}
