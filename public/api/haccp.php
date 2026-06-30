<?php
/**
 * public/api/haccp.php — registro IPM/HACCP (superamenti soglia).
 * Lettura: capability 'haccp.view' (admin, supervisore).
 * Rigenerazione manuale: capability 'interventi.manage'.
 */

require_once __DIR__ . '/../../src/bootstrap.php';
require_once __DIR__ . '/../../src/haccp.php';

$pdo = db();
$action = $_GET['action'] ?? 'registro';

switch ($action) {

    case 'registro': {
        require_can('haccp.view');
        $rows = haccp_registro($pdo, [
            'cliente_id' => $_GET['cliente_id'] ?? null,
            'locale_id'  => $_GET['locale_id'] ?? null,
            'esito'      => $_GET['esito'] ?? null,
            'from'       => $_GET['from'] ?? null,
            'to'         => $_GET['to'] ?? null,
        ]);
        json_ok(['registro' => $rows]);
        break;
    }

    case 'summary': {
        require_can('haccp.view');
        $tot = (int) $pdo->query('SELECT COUNT(*) FROM haccp_log')->fetchColumn();
        $sup = (int) $pdo->query("SELECT COUNT(*) FROM haccp_log WHERE esito='superato'")->fetchColumn();
        json_ok(['totale' => $tot, 'superati' => $sup, 'non_superati' => $tot - $sup]);
        break;
    }

    case 'rigenera': {
        require_can('interventi.manage');
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $id = (int) ($in['intervento_id'] ?? 0);
        $stmt = $pdo->prepare('SELECT locale_id, data FROM interventi WHERE id = ?');
        $stmt->execute([$id]);
        $i = $stmt->fetch();
        if (!$i) { json_fail('Intervento non trovato', 404); }
        $n = haccp_log_breaches($pdo, $id, (int) $i['locale_id'], $i['data']);
        json_ok(['superamenti' => $n]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}
