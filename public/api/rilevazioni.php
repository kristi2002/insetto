<?php
/**
 * public/api/rilevazioni.php — rilevazioni per postazione (app tecnico).
 *
 *   POST ?action=save   { intervento_id, postazione_id, catture, consumo_esca_pct, stato_trappola }
 *
 * Upsert: una sola rilevazione per (intervento, postazione).
 * Accesso: admin oppure il tecnico assegnato all'intervento.
 */

require_once __DIR__ . '/../../src/bootstrap.php';

$pdo = db();
$user = require_login();
$action = $_GET['action'] ?? '';

if ($action !== 'save') {
    json_fail('Azione non valida', 404);
}

require_method('POST');
verify_csrf();
$in = read_json_body();
$interventoId  = (int) ($in['intervento_id'] ?? 0);
$postazioneId  = (int) ($in['postazione_id'] ?? 0);
if (!$interventoId || !$postazioneId) {
    json_fail('Intervento e postazione obbligatori', 422);
}

// Controllo accesso: intervento esistente, non inviato, tecnico assegnato o admin.
$stmt = $pdo->prepare('SELECT i.tecnico_id, i.stato, l.id AS locale_id
                       FROM interventi i JOIN locali l ON l.id = i.locale_id WHERE i.id = ?');
$stmt->execute([$interventoId]);
$intervento = $stmt->fetch();
if (!$intervento) { json_fail('Intervento non trovato', 404); }
if ($user['ruolo'] === 'tecnico' && (int) $intervento['tecnico_id'] !== (int) $user['id']) {
    json_fail('Permesso negato', 403);
}
if ($user['ruolo'] === 'cliente') { json_fail('Permesso negato', 403); }
if ($intervento['stato'] === 'inviato') { json_fail('Intervento già inviato', 409); }

// La postazione deve appartenere al locale dell'intervento.
$stmt = $pdo->prepare('SELECT a.locale_id FROM postazioni p JOIN aree a ON a.id = p.area_id WHERE p.id = ?');
$stmt->execute([$postazioneId]);
$loc = $stmt->fetchColumn();
if ((int) $loc !== (int) $intervento['locale_id']) {
    json_fail('La postazione non appartiene al locale dell\'intervento', 422);
}

$catture  = int_or_null(field($in, 'catture'));
$consumo  = int_or_null(field($in, 'consumo_esca_pct'));
if ($consumo !== null) { $consumo = max(0, min(100, $consumo)); }
$stato    = field($in, 'stato_trappola', 'OK') ?: 'OK';

// Upsert
$stmt = $pdo->prepare('SELECT id FROM rilevazioni_postazione WHERE intervento_id = ? AND postazione_id = ?');
$stmt->execute([$interventoId, $postazioneId]);
$existing = $stmt->fetch();

if ($existing) {
    $pdo->prepare('UPDATE rilevazioni_postazione SET catture=?, consumo_esca_pct=?, stato_trappola=? WHERE id=?')
        ->execute([$catture, $consumo, $stato, $existing['id']]);
    $rid = (int) $existing['id'];
} else {
    $pdo->prepare('INSERT INTO rilevazioni_postazione (intervento_id, postazione_id, catture, consumo_esca_pct, stato_trappola) VALUES (?,?,?,?,?)')
        ->execute([$interventoId, $postazioneId, $catture, $consumo, $stato]);
    $rid = (int) $pdo->lastInsertId();
}

json_ok(['id' => $rid]);
