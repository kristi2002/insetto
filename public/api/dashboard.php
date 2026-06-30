<?php
/**
 * public/api/dashboard.php — KPI del gestionale.
 * Capability 'dashboard.view' (admin, supervisore).
 *
 * action=overview restituisce:
 *   - contatori generali
 *   - interventi per tecnico
 *   - interventi per area
 *   - postazioni che superano le soglie
 *   - trend infestazioni (per mese)
 */

require_once __DIR__ . '/../../src/bootstrap.php';
require_once __DIR__ . '/../../src/inventory.php';

$pdo = db();
require_can('dashboard.view');

$action = $_GET['action'] ?? 'overview';
if ($action !== 'overview') { json_fail('Azione non valida', 404); }

/* ---- Contatori ---- */
$counters = [
    'clienti'    => (int) $pdo->query("SELECT COUNT(*) FROM clienti WHERE stato <> 'archiviato'")->fetchColumn(),
    'locali'     => (int) $pdo->query('SELECT COUNT(*) FROM locali')->fetchColumn(),
    'postazioni' => (int) $pdo->query('SELECT COUNT(*) FROM postazioni WHERE attiva = 1')->fetchColumn(),
    'interventi' => (int) $pdo->query('SELECT COUNT(*) FROM interventi')->fetchColumn(),
    'alert_riordino' => count(reorder_alerts($pdo)),
];

/* ---- Interventi per tecnico ---- */
$perTecnico = $pdo->query(
    'SELECT u.nome AS tecnico, COUNT(i.id) AS n
     FROM interventi i JOIN users u ON u.id = i.tecnico_id
     GROUP BY u.id ORDER BY n DESC'
)->fetchAll();

/* ---- Interventi per area (via rilevazioni) ---- */
$perArea = $pdo->query(
    'SELECT a.nome AS area, a.tipo, COUNT(DISTINCT r.intervento_id) AS n
     FROM rilevazioni_postazione r
     JOIN postazioni p ON p.id = r.postazione_id
     JOIN aree a ON a.id = p.area_id
     GROUP BY a.id ORDER BY n DESC'
)->fetchAll();

/* ---- Postazioni/aree oltre soglia (dal registro HACCP) ---- */
$soglieSuperate = (int) $pdo->query("SELECT COUNT(*) FROM haccp_log WHERE esito='superato'")->fetchColumn();
$dettaglioSoglie = $pdo->query(
    "SELECT h.data, h.con_attivita, h.limite, h.totale_postazioni,
            a.nome AS area_nome, td.nome AS tipo_nome, l.nome AS locale_nome, c.ragione_sociale AS cliente_nome
     FROM haccp_log h
     JOIN interventi i ON i.id = h.intervento_id
     JOIN locali l ON l.id = i.locale_id
     JOIN clienti c ON c.id = l.cliente_id
     LEFT JOIN aree a ON a.id = h.area_id
     LEFT JOIN tipi_dispositivo td ON td.id = h.tipo_dispositivo_id
     WHERE h.esito='superato'
     ORDER BY h.data DESC, h.id DESC LIMIT 20"
)->fetchAll();

/* ---- Trend infestazioni per mese (ultimi 12 mesi) ---- */
$trend = $pdo->query(
    "SELECT DATE_FORMAT(i.data, '%Y-%m') AS mese,
            COALESCE(SUM(r.catture), 0) AS catture,
            COALESCE(SUM(r.consumo_esca_pct), 0) AS consumo,
            COUNT(DISTINCT i.id) AS interventi
     FROM interventi i
     LEFT JOIN rilevazioni_postazione r ON r.intervento_id = i.id
     WHERE i.data >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
     GROUP BY mese ORDER BY mese"
)->fetchAll();

json_ok([
    'counters'        => $counters,
    'per_tecnico'     => $perTecnico,
    'per_area'        => $perArea,
    'soglie_superate' => $soglieSuperate,
    'dettaglio_soglie'=> $dettaglioSoglie,
    'trend'           => $trend,
]);
