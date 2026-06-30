<?php
/**
 * public/api/magazzino.php — inventario: articoli, lotti, alert, consumi.
 *
 * Lettura/consumo: capability 'magazzino.use' (admin, supervisore, tecnico)
 * Gestione catalogo: capability 'magazzino.manage' (admin, supervisore)
 */

require_once __DIR__ . '/../../src/bootstrap.php';
require_once __DIR__ . '/../../src/inventory.php';

$pdo = db();
$action = $_GET['action'] ?? '';

// Azioni di sola gestione catalogo
$manageActions = ['articolo_save', 'articolo_delete', 'lotto_save', 'lotto_delete'];
$user = in_array($action, $manageActions, true)
    ? require_can('magazzino.manage')
    : require_can('magazzino.use');

switch ($action) {

    case 'articoli_list':
        json_ok(['articoli' => articoli_con_giacenza($pdo)]);
        break;

    case 'alerts':
        json_ok([
            'riordino'  => reorder_alerts($pdo),
            'scadenza'  => lotti_in_scadenza($pdo, (int) ($_GET['giorni'] ?? 60)),
        ]);
        break;

    case 'articolo_save': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        if (field($in, 'nome', '') === '') { json_fail('Nome obbligatorio', 422); }
        $tipo = in_array(field($in, 'tipo'), ['esca','trappola','prodotto','presidio'], true) ? field($in, 'tipo') : 'prodotto';
        $id = (int) ($in['id'] ?? 0);
        if ($id) {
            $pdo->prepare('UPDATE articoli SET nome=?, tipo=?, codice=?, unita=?, prezzo_unitario=?, soglia_riordino=?, attivo=? WHERE id=?')
                ->execute([
                    field($in, 'nome'), $tipo, field($in, 'codice'), field($in, 'unita', 'pz') ?: 'pz',
                    (float) ($in['prezzo_unitario'] ?? 0), (float) ($in['soglia_riordino'] ?? 0),
                    !empty($in['attivo']) ? 1 : 0, $id,
                ]);
        } else {
            $pdo->prepare('INSERT INTO articoli (nome, tipo, codice, unita, prezzo_unitario, soglia_riordino) VALUES (?,?,?,?,?,?)')
                ->execute([
                    field($in, 'nome'), $tipo, field($in, 'codice'), field($in, 'unita', 'pz') ?: 'pz',
                    (float) ($in['prezzo_unitario'] ?? 0), (float) ($in['soglia_riordino'] ?? 0),
                ]);
            $id = (int) $pdo->lastInsertId();
        }
        json_ok(['id' => $id]);
        break;
    }

    case 'articolo_delete':
        require_method('POST');
        verify_csrf();
        $pdo->prepare('DELETE FROM articoli WHERE id = ?')->execute([(int) ($_GET['id'] ?? 0)]);
        json_ok([]);
        break;

    case 'lotti_list': {
        $stmt = $pdo->prepare('SELECT * FROM lotti WHERE articolo_id = ? ORDER BY (scadenza IS NULL), scadenza ASC, id DESC');
        $stmt->execute([(int) ($_GET['articolo_id'] ?? 0)]);
        json_ok(['lotti' => $stmt->fetchAll()]);
        break;
    }

    case 'lotto_save': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $artId = (int) ($in['articolo_id'] ?? 0);
        if (!$artId || field($in, 'codice_lotto', '') === '') { json_fail('Articolo e codice lotto obbligatori', 422); }
        $qta = (float) ($in['quantita_iniziale'] ?? 0);
        $scad = field($in, 'scadenza') ?: null;
        $id = (int) ($in['id'] ?? 0);
        if ($id) {
            // In modifica si aggiorna anche il residuo se aumenta la giacenza iniziale.
            $pdo->prepare('UPDATE lotti SET codice_lotto=?, scadenza=?, quantita_iniziale=?, quantita_residua=? WHERE id=?')
                ->execute([field($in, 'codice_lotto'), $scad, $qta, (float) ($in['quantita_residua'] ?? $qta), $id]);
        } else {
            $pdo->prepare('INSERT INTO lotti (articolo_id, codice_lotto, scadenza, quantita_iniziale, quantita_residua) VALUES (?,?,?,?,?)')
                ->execute([$artId, field($in, 'codice_lotto'), $scad, $qta, $qta]);
            $id = (int) $pdo->lastInsertId();
        }
        json_ok(['id' => $id]);
        break;
    }

    case 'lotto_delete':
        require_method('POST');
        verify_csrf();
        $pdo->prepare('DELETE FROM lotti WHERE id = ?')->execute([(int) ($_GET['id'] ?? 0)]);
        json_ok([]);
        break;

    case 'consumi_list':
        json_ok(['consumi' => consumi_intervento($pdo, (int) ($_GET['intervento_id'] ?? 0))]);
        break;

    case 'consumo_save': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $interventoId = (int) ($in['intervento_id'] ?? 0);
        $articoloId = (int) ($in['articolo_id'] ?? 0);
        $qta = (float) ($in['quantita'] ?? 0);
        if (!$interventoId || !$articoloId || $qta <= 0) { json_fail('Intervento, articolo e quantità validi sono obbligatori', 422); }

        // Il tecnico può registrare consumi solo sui propri interventi.
        $stmt = $pdo->prepare('SELECT tecnico_id, stato FROM interventi WHERE id = ?');
        $stmt->execute([$interventoId]);
        $i = $stmt->fetch();
        if (!$i) { json_fail('Intervento non trovato', 404); }
        if ($user['ruolo'] === 'tecnico' && (int) $i['tecnico_id'] !== (int) $user['id']) { json_fail('Permesso negato', 403); }
        if ($i['stato'] === 'inviato') { json_fail('Intervento già inviato', 409); }

        try {
            $id = registra_consumo($pdo, $interventoId, $articoloId, int_or_null(field($in, 'lotto_id')), $qta);
        } catch (Throwable $e) {
            json_fail('Errore registrazione consumo: ' . $e->getMessage(), 500);
        }
        json_ok(['id' => $id]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}
