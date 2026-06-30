<?php
/**
 * public/api/documenti.php — preventivi e fatture (SDI).
 * Capability 'documenti.manage' (admin, supervisore).
 */

require_once __DIR__ . '/../../src/bootstrap.php';
require_once __DIR__ . '/../../src/invoicing.php';
require_once __DIR__ . '/../../src/inventory.php';

$pdo = db();
require_can('documenti.manage');
$action = $_GET['action'] ?? 'list';

switch ($action) {

    case 'list': {
        $sql = 'SELECT d.id, d.tipo, d.numero, d.data, d.imponibile, d.iva, d.totale, d.stato,
                       c.ragione_sociale AS cliente_nome
                FROM documenti d JOIN clienti c ON c.id = d.cliente_id WHERE 1=1';
        $args = [];
        if (!empty($_GET['tipo'])) { $sql .= ' AND d.tipo = ?'; $args[] = $_GET['tipo']; }
        if (!empty($_GET['cliente_id'])) { $sql .= ' AND d.cliente_id = ?'; $args[] = (int) $_GET['cliente_id']; }
        $sql .= ' ORDER BY d.data DESC, d.id DESC';
        $stmt = $pdo->prepare($sql); $stmt->execute($args);
        json_ok(['documenti' => $stmt->fetchAll()]);
        break;
    }

    case 'get': {
        $d = documento_completo($pdo, (int) ($_GET['id'] ?? 0));
        if (!$d) { json_fail('Documento non trovato', 404); }
        json_ok(['documento' => $d]);
        break;
    }

    case 'create': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $tipo = in_array(field($in, 'tipo'), ['preventivo','fattura'], true) ? field($in, 'tipo') : 'preventivo';
        $clienteId = (int) ($in['cliente_id'] ?? 0);
        $data = field($in, 'data') ?: date('Y-m-d');
        if (!$clienteId) { json_fail('Cliente obbligatorio', 422); }
        $anno = (int) substr($data, 0, 4);

        $pdo->beginTransaction();
        try {
            $pdo->prepare('INSERT INTO documenti (tipo, numero, anno, data, cliente_id, intervento_id, aliquota_iva, note) VALUES (?,?,?,?,?,?,?,?)')
                ->execute([
                    $tipo, prossimo_numero($pdo, $tipo, $anno), $anno, $data, $clienteId,
                    int_or_null(field($in, 'intervento_id')),
                    (float) ($in['aliquota_iva'] ?? IVA_DEFAULT), field($in, 'note'),
                ]);
            $id = (int) $pdo->lastInsertId();
            salva_righe($pdo, $id, $in['righe'] ?? []);
            ricalcola_righe($pdo, $id);
            ricalcola_totali($pdo, $id);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            json_fail('Errore creazione documento: ' . $e->getMessage(), 500);
        }
        json_ok(['id' => $id]);
        break;
    }

    case 'update': {
        require_method('PUT');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $in = read_json_body();
        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE documenti SET data=?, note=?, aliquota_iva=? WHERE id=?')
                ->execute([field($in, 'data') ?: date('Y-m-d'), field($in, 'note'), (float) ($in['aliquota_iva'] ?? IVA_DEFAULT), $id]);
            $pdo->prepare('DELETE FROM documento_righe WHERE documento_id = ?')->execute([$id]);
            salva_righe($pdo, $id, $in['righe'] ?? []);
            ricalcola_righe($pdo, $id);
            ricalcola_totali($pdo, $id);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            json_fail('Errore aggiornamento: ' . $e->getMessage(), 500);
        }
        json_ok(['id' => $id]);
        break;
    }

    case 'set_stato': {
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $in = read_json_body();
        $stato = field($in, 'stato');
        if (!in_array($stato, ['bozza','emesso','inviato_sdi','pagato','annullato'], true)) { json_fail('Stato non valido', 422); }
        $pdo->prepare('UPDATE documenti SET stato=? WHERE id=?')->execute([$stato, $id]);
        json_ok(['id' => $id, 'stato' => $stato]);
        break;
    }

    case 'delete': {
        require_method('POST');
        verify_csrf();
        $pdo->prepare('DELETE FROM documenti WHERE id = ?')->execute([(int) ($_GET['id'] ?? 0)]);
        json_ok([]);
        break;
    }

    case 'genera_xml': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $id = (int) ($in['id'] ?? 0);
        try {
            $path = genera_xml_sdi($pdo, $id);
            $pdo->prepare("UPDATE documenti SET stato = 'emesso' WHERE id = ? AND stato = 'bozza'")->execute([$id]);
        } catch (Throwable $e) {
            json_fail($e->getMessage(), 400);
        }
        json_ok(['xml' => basename($path)]);
        break;
    }

    case 'download_xml': {
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT xml_path FROM documenti WHERE id = ?');
        $stmt->execute([$id]);
        $path = $stmt->fetchColumn();
        if (!$path || !is_file($path)) {
            try { $path = genera_xml_sdi($pdo, $id); }
            catch (Throwable $e) { json_fail($e->getMessage(), 400); }
        }
        header('Content-Type: application/xml; charset=utf-8');
        header('Content-Disposition: attachment; filename="fattura_' . $id . '.xml"');
        readfile($path);
        exit;
    }

    case 'from_intervento': {
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $interventoId = (int) ($in['intervento_id'] ?? 0);
        $tipo = in_array(field($in, 'tipo'), ['preventivo','fattura'], true) ? field($in, 'tipo') : 'fattura';

        $stmt = $pdo->prepare(
            'SELECT i.id, i.data, i.tipologia, l.cliente_id, l.nome AS locale_nome
             FROM interventi i JOIN locali l ON l.id = i.locale_id WHERE i.id = ?'
        );
        $stmt->execute([$interventoId]);
        $i = $stmt->fetch();
        if (!$i) { json_fail('Intervento non trovato', 404); }

        // Righe: servizio intervento + prodotti consumati.
        $righe = [[
            'descrizione' => 'Intervento ' . $i['tipologia'] . ' del ' . $i['data'] . ' — ' . $i['locale_nome'],
            'quantita' => 1, 'prezzo_unitario' => (float) ($in['prezzo_servizio'] ?? 0), 'aliquota_iva' => IVA_DEFAULT,
        ]];
        foreach (consumi_intervento($pdo, $interventoId) as $c) {
            $prezzo = 0.0;
            $st = $pdo->prepare('SELECT prezzo_unitario FROM articoli WHERE id = ?');
            $st->execute([$c['articolo_id']]);
            $prezzo = (float) $st->fetchColumn();
            $righe[] = [
                'descrizione' => 'Prodotto: ' . $c['articolo_nome'] . ' (' . rtrim(rtrim($c['quantita'], '0'), '.') . ' ' . $c['unita'] . ')',
                'quantita' => (float) $c['quantita'], 'prezzo_unitario' => $prezzo, 'aliquota_iva' => IVA_DEFAULT,
            ];
        }

        $anno = (int) substr($i['data'], 0, 4);
        $pdo->beginTransaction();
        try {
            $pdo->prepare('INSERT INTO documenti (tipo, numero, anno, data, cliente_id, intervento_id, aliquota_iva) VALUES (?,?,?,?,?,?,?)')
                ->execute([$tipo, prossimo_numero($pdo, $tipo, $anno), $anno, date('Y-m-d'), (int) $i['cliente_id'], $interventoId, IVA_DEFAULT]);
            $id = (int) $pdo->lastInsertId();
            salva_righe($pdo, $id, $righe);
            ricalcola_righe($pdo, $id);
            ricalcola_totali($pdo, $id);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            json_fail('Errore: ' . $e->getMessage(), 500);
        }
        json_ok(['id' => $id]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}

/** Inserisce le righe di un documento. */
function salva_righe(PDO $pdo, int $documentoId, array $righe): void
{
    $ins = $pdo->prepare(
        'INSERT INTO documento_righe (documento_id, descrizione, quantita, prezzo_unitario, aliquota_iva, importo) VALUES (?,?,?,?,?,0)'
    );
    foreach ($righe as $r) {
        $desc = trim((string) ($r['descrizione'] ?? ''));
        if ($desc === '') { continue; }
        $ins->execute([
            $documentoId, $desc,
            (float) ($r['quantita'] ?? 1),
            (float) ($r['prezzo_unitario'] ?? 0),
            (float) ($r['aliquota_iva'] ?? IVA_DEFAULT),
        ]);
    }
}
