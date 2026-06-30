<?php
/**
 * public/api/portale.php — endpoint di sola lettura per il portale cliente.
 * Tutti i dati sono filtrati sul cliente_id dell'utente in sessione.
 *
 *   GET ?action=overview
 *   GET ?action=postazioni&locale_id=
 *   GET ?action=intervento&id=        (dettaglio sola lettura)
 */

require_once __DIR__ . '/../../src/bootstrap.php';
require_once __DIR__ . '/../../src/soglie.php';

$user = require_role('cliente');
$clienteId = (int) $user['cliente_id'];
if (!$clienteId) { json_fail('Account cliente non associato ad alcun cliente', 409); }

$pdo = db();
$action = $_GET['action'] ?? 'overview';

/** Verifica che un locale appartenga al cliente loggato. */
function own_locale(PDO $pdo, int $localeId, int $clienteId): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM locali WHERE id = ? AND cliente_id = ?');
    $stmt->execute([$localeId, $clienteId]);
    return (bool) $stmt->fetchColumn();
}

switch ($action) {

    case 'overview': {
        $stmt = $pdo->prepare('SELECT ragione_sociale, partita_iva, email, telefono FROM clienti WHERE id = ?');
        $stmt->execute([$clienteId]);
        $cliente = $stmt->fetch();

        $stmt = $pdo->prepare(
            'SELECT l.id, l.nome, l.indirizzo, l.frequenza_servizio,
                    (SELECT COUNT(*) FROM postazioni p JOIN aree a ON a.id = p.area_id WHERE a.locale_id = l.id) AS num_postazioni
             FROM locali l WHERE l.cliente_id = ? AND l.stato <> "archiviato" ORDER BY l.nome'
        );
        $stmt->execute([$clienteId]);
        $locali = $stmt->fetchAll();

        // Interventi (solo validati/inviati: il cliente non vede le bozze)
        $stmt = $pdo->prepare(
            "SELECT i.id, i.data, i.tipologia, i.stato, l.nome AS locale_nome, u.nome AS tecnico_nome,
                    (SELECT inviato_at FROM report r WHERE r.intervento_id = i.id) AS report_inviato
             FROM interventi i
             JOIN locali l ON l.id = i.locale_id
             JOIN users u ON u.id = i.tecnico_id
             WHERE l.cliente_id = ? AND i.stato IN ('validato','inviato')
             ORDER BY i.data DESC, i.id DESC"
        );
        $stmt->execute([$clienteId]);
        $interventi = $stmt->fetchAll();

        json_ok(['cliente' => $cliente, 'locali' => $locali, 'interventi' => $interventi]);
        break;
    }

    case 'postazioni': {
        $localeId = (int) ($_GET['locale_id'] ?? 0);
        if (!own_locale($pdo, $localeId, $clienteId)) { json_fail('Permesso negato', 403); }
        $stmt = $pdo->prepare(
            'SELECT p.numero, p.ubicazione, p.grado_rischio, p.qr_code,
                    a.nome AS area_nome, a.tipo AS area_tipo, td.nome AS tipo_nome
             FROM postazioni p JOIN aree a ON a.id = p.area_id
             JOIN tipi_dispositivo td ON td.id = p.tipo_dispositivo_id
             WHERE a.locale_id = ? AND p.attiva = 1 ORDER BY a.tipo, a.nome, p.numero'
        );
        $stmt->execute([$localeId]);
        json_ok(['postazioni' => $stmt->fetchAll()]);
        break;
    }

    case 'intervento': {
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare(
            "SELECT i.*, l.nome AS locale_nome, l.cliente_id, u.nome AS tecnico_nome
             FROM interventi i JOIN locali l ON l.id = i.locale_id JOIN users u ON u.id = i.tecnico_id
             WHERE i.id = ?"
        );
        $stmt->execute([$id]);
        $i = $stmt->fetch();
        if (!$i || (int) $i['cliente_id'] !== $clienteId || !in_array($i['stato'], ['validato', 'inviato'], true)) {
            json_fail('Intervento non disponibile', 404);
        }
        $i['soglie'] = calcola_soglie($pdo, $id, (int) $i['locale_id']);
        $stmt = $pdo->prepare(
            'SELECT e.*, a.nome AS area_nome FROM evidenze e LEFT JOIN aree a ON a.id = e.area_id WHERE e.intervento_id = ?'
        );
        $stmt->execute([$id]);
        $i['evidenze'] = $stmt->fetchAll();
        json_ok(['intervento' => $i]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}
