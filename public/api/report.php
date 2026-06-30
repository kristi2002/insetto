<?php
/**
 * public/api/report.php — generazione, download e invio del report PDF.
 *
 *   POST ?action=generate   { intervento_id }   [admin|tecnico assegnato]
 *   GET  ?action=download&intervento_id=        [admin|tecnico assegnato|cliente proprietario]
 *   POST ?action=send       { intervento_id }   [admin|tecnico assegnato]
 */

require_once __DIR__ . '/../../src/bootstrap.php';
require_once __DIR__ . '/../../src/report.php';

$pdo = db();
$user = require_login();
$action = $_GET['action'] ?? '';

/** Carica intervento + verifica accesso secondo il ruolo. */
function intervento_access(PDO $pdo, int $id, array $user, bool $write): array
{
    $stmt = $pdo->prepare(
        'SELECT i.id, i.tecnico_id, i.stato, l.cliente_id
         FROM interventi i JOIN locali l ON l.id = i.locale_id WHERE i.id = ?'
    );
    $stmt->execute([$id]);
    $i = $stmt->fetch();
    if (!$i) { json_fail('Intervento non trovato', 404); }

    if ($user['ruolo'] === 'tecnico' && (int) $i['tecnico_id'] !== (int) $user['id']) {
        json_fail('Permesso negato', 403);
    }
    if ($user['ruolo'] === 'cliente') {
        if ($write || (int) $i['cliente_id'] !== (int) $user['cliente_id']) { json_fail('Permesso negato', 403); }
    }
    return $i;
}

switch ($action) {

    case 'generate': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $id = (int) ($in['intervento_id'] ?? 0);
        intervento_access($pdo, $id, $user, true);
        try {
            $path = genera_report_pdf($pdo, $id);
        } catch (Throwable $e) {
            json_fail('Errore generazione PDF: ' . $e->getMessage(), 500);
        }
        json_ok(['path' => basename($path)]);
        break;
    }

    case 'download': {
        $id = (int) ($_GET['intervento_id'] ?? 0);
        intervento_access($pdo, $id, $user, false);
        // Recupera o (ri)genera il PDF.
        $stmt = $pdo->prepare('SELECT pdf_path FROM report WHERE intervento_id = ?');
        $stmt->execute([$id]);
        $path = $stmt->fetchColumn();
        if (!$path || !is_file($path)) {
            try { $path = genera_report_pdf($pdo, $id); }
            catch (Throwable $e) { json_fail('Errore generazione PDF: ' . $e->getMessage(), 500); }
        }
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="report_intervento_' . $id . '.pdf"');
        header('Content-Length: ' . filesize($path));
        readfile($path);
        exit;
    }

    case 'send': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $id = (int) ($in['intervento_id'] ?? 0);
        intervento_access($pdo, $id, $user, true);
        try {
            $path = genera_report_pdf($pdo, $id);
        } catch (Throwable $e) {
            json_fail('Errore generazione PDF: ' . $e->getMessage(), 500);
        }
        [$sent, $note] = invia_report_email($pdo, $id, $path);

        // Aggiorna stato: l'intervento passa a "inviato" e si registra l'invio.
        $pdo->prepare('UPDATE report SET inviato_at = NOW() WHERE intervento_id = ?')->execute([$id]);
        // Passa a "inviato" e garantisce la data di validazione (per la riga di validazione nel PDF).
        $pdo->prepare("UPDATE interventi SET stato = 'inviato', validato_at = COALESCE(validato_at, NOW()) WHERE id = ?")->execute([$id]);

        json_ok(['email_sent' => $sent, 'note' => $note]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}
