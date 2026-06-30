<?php
/**
 * public/api/interventi.php — pianificazione + dettaglio interventi.
 *
 *   GET  ?action=list[&stato=&from=&to=&tecnico_id=&oggi=1]
 *   GET  ?action=get&id=
 *   GET  ?action=tecnici                     [admin]  elenco tecnici
 *   POST ?action=create                      [admin]
 *   PUT  ?action=update_manutenzione&id=     [admin|tecnico assegnato]
 *   POST ?action=validate&id=                [admin|tecnico assegnato]
 *   POST ?action=delete&id=                  [admin]
 */

require_once __DIR__ . '/../../src/bootstrap.php';
require_once __DIR__ . '/../../src/soglie.php';
require_once __DIR__ . '/../../src/haccp.php';

$pdo = db();
$user = require_login();
$action = $_GET['action'] ?? 'list';

switch ($action) {

    case 'tecnici': {
        require_role('admin', 'supervisore');
        $stmt = $pdo->query("SELECT id, nome, email FROM users WHERE ruolo='tecnico' AND attivo=1 ORDER BY nome");
        json_ok(['tecnici' => $stmt->fetchAll()]);
        break;
    }

    case 'list': {
        $sql = "SELECT i.id, i.data, i.tipologia, i.stato, i.validato_at,
                       l.id AS locale_id, l.nome AS locale_nome,
                       c.id AS cliente_id, c.ragione_sociale AS cliente_nome,
                       u.nome AS tecnico_nome
                FROM interventi i
                JOIN locali l   ON l.id = i.locale_id
                JOIN clienti c  ON c.id = l.cliente_id
                JOIN users u    ON u.id = i.tecnico_id
                WHERE 1=1";
        $args = [];

        // Restrizione per ruolo
        if ($user['ruolo'] === 'tecnico') {
            $sql .= ' AND i.tecnico_id = ?';
            $args[] = $user['id'];
        } elseif ($user['ruolo'] === 'cliente') {
            $sql .= ' AND c.id = ?';
            $args[] = $user['cliente_id'];
        }

        // Filtri opzionali
        if (!empty($_GET['oggi'])) {
            $sql .= ' AND i.data = CURDATE()';
        }
        if (!empty($_GET['locale_id'])) { $sql .= ' AND i.locale_id = ?'; $args[] = (int) $_GET['locale_id']; }
        if (!empty($_GET['stato'])) { $sql .= ' AND i.stato = ?'; $args[] = $_GET['stato']; }
        if (!empty($_GET['from']))  { $sql .= ' AND i.data >= ?'; $args[] = $_GET['from']; }
        if (!empty($_GET['to']))    { $sql .= ' AND i.data <= ?'; $args[] = $_GET['to']; }
        if (!empty($_GET['tecnico_id']) && $user['ruolo'] === 'admin') {
            $sql .= ' AND i.tecnico_id = ?'; $args[] = (int) $_GET['tecnico_id'];
        }

        $sql .= ' ORDER BY i.data DESC, i.id DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($args);
        json_ok(['interventi' => $stmt->fetchAll()]);
        break;
    }

    case 'get': {
        $id = (int) ($_GET['id'] ?? 0);
        $i = load_intervento_or_403($pdo, $id, $user);

        // Postazioni del locale + eventuale rilevazione di questo intervento
        $stmt = $pdo->prepare(
            'SELECT p.id, p.numero, p.ubicazione, p.qr_code, p.grado_rischio,
                    a.id AS area_id, a.nome AS area_nome, a.tipo AS area_tipo,
                    td.nome AS tipo_nome, td.metrica,
                    r.id AS rilevazione_id, r.catture, r.consumo_esca_pct, r.stato_trappola
             FROM postazioni p
             JOIN aree a ON a.id = p.area_id
             JOIN tipi_dispositivo td ON td.id = p.tipo_dispositivo_id
             LEFT JOIN rilevazioni_postazione r ON r.postazione_id = p.id AND r.intervento_id = ?
             WHERE a.locale_id = ? AND p.attiva = 1
             ORDER BY a.tipo, a.nome, p.numero'
        );
        $stmt->execute([$id, $i['locale_id']]);
        $i['postazioni'] = $stmt->fetchAll();

        // Evidenze
        $stmt = $pdo->prepare(
            'SELECT e.*, a.nome AS area_nome FROM evidenze e
             LEFT JOIN aree a ON a.id = e.area_id WHERE e.intervento_id = ? ORDER BY e.id'
        );
        $stmt->execute([$id]);
        $i['evidenze'] = $stmt->fetchAll();

        // Soglie calcolate
        $i['soglie'] = calcola_soglie($pdo, $id, (int) $i['locale_id']);

        json_ok(['intervento' => $i]);
        break;
    }

    case 'create': {
        require_role('admin', 'supervisore');
        require_method('POST');
        verify_csrf();
        $in = read_json_body();
        $localeId  = (int) ($in['locale_id'] ?? 0);
        $tecnicoId = (int) ($in['tecnico_id'] ?? 0);
        $data      = field($in, 'data', '');
        $tipologia = field($in, 'tipologia', 'programmato');
        if (!$localeId || !$tecnicoId || $data === '') {
            json_fail('Locale, tecnico e data sono obbligatori', 422);
        }
        if (!in_array($tipologia, ['programmato', 'straordinario', 'primo_impianto', 'sopralluogo'], true)) {
            $tipologia = 'programmato';
        }
        $stmt = $pdo->prepare(
            'INSERT INTO interventi (locale_id, tecnico_id, data, tipologia) VALUES (?,?,?,?)'
        );
        $stmt->execute([$localeId, $tecnicoId, $data, $tipologia]);
        json_ok(['id' => (int) $pdo->lastInsertId()]);
        break;
    }

    case 'update': {
        require_role('admin', 'supervisore');
        require_method('PUT');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT stato FROM interventi WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) { json_fail('Intervento non trovato', 404); }
        if ($row['stato'] === 'inviato') { json_fail('Intervento già inviato: non modificabile', 409); }
        $in = read_json_body();
        $localeId  = (int) ($in['locale_id'] ?? 0);
        $tecnicoId = (int) ($in['tecnico_id'] ?? 0);
        $data      = field($in, 'data', '');
        $tipologia = field($in, 'tipologia', 'programmato');
        if (!$localeId || !$tecnicoId || $data === '') {
            json_fail('Locale, tecnico e data sono obbligatori', 422);
        }
        if (!in_array($tipologia, ['programmato', 'straordinario', 'primo_impianto', 'sopralluogo'], true)) {
            $tipologia = 'programmato';
        }
        $pdo->prepare('UPDATE interventi SET locale_id=?, tecnico_id=?, data=?, tipologia=? WHERE id=?')
            ->execute([$localeId, $tecnicoId, $data, $tipologia, $id]);
        json_ok(['id' => $id]);
        break;
    }

    case 'update_manutenzione': {
        require_method('PUT');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $i = load_intervento_or_403($pdo, $id, $user, true);
        if ($i['stato'] === 'inviato') { json_fail('Intervento già inviato: non modificabile', 409); }
        $in = read_json_body();
        $pdo->prepare(
            'UPDATE interventi SET stato_strutture=?, stato_serramenti=?, segnalazioni=? WHERE id=?'
        )->execute([
            field($in, 'stato_strutture'),
            field($in, 'stato_serramenti'),
            field($in, 'segnalazioni'),
            $id,
        ]);
        json_ok(['id' => $id]);
        break;
    }

    case 'save_letture': {
        // Salvataggio transazionale: manutenzione + tutte le rilevazioni.
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $i = load_intervento_or_403($pdo, $id, $user, true);
        if ($i['stato'] === 'inviato') { json_fail('Intervento già inviato: non modificabile', 409); }
        $in = read_json_body();
        $rilevazioni = (isset($in['rilevazioni']) && is_array($in['rilevazioni'])) ? $in['rilevazioni'] : [];

        $pdo->beginTransaction();
        try {
            // 1) Stato manutenzione
            $pdo->prepare('UPDATE interventi SET stato_strutture=?, stato_serramenti=?, segnalazioni=? WHERE id=?')
                ->execute([field($in, 'stato_strutture'), field($in, 'stato_serramenti'), field($in, 'segnalazioni'), $id]);

            // 2) Rilevazioni (upsert per postazione, solo postazioni del locale)
            $chk  = $pdo->prepare('SELECT a.locale_id FROM postazioni p JOIN aree a ON a.id = p.area_id WHERE p.id = ?');
            $sel  = $pdo->prepare('SELECT id FROM rilevazioni_postazione WHERE intervento_id = ? AND postazione_id = ?');
            $insR = $pdo->prepare('INSERT INTO rilevazioni_postazione (intervento_id, postazione_id, catture, consumo_esca_pct, stato_trappola) VALUES (?,?,?,?,?)');
            $updR = $pdo->prepare('UPDATE rilevazioni_postazione SET catture=?, consumo_esca_pct=?, stato_trappola=? WHERE id=?');

            $saved = 0;
            foreach ($rilevazioni as $r) {
                $pid = (int) ($r['postazione_id'] ?? 0);
                if (!$pid) { continue; }
                $chk->execute([$pid]);
                if ((int) $chk->fetchColumn() !== (int) $i['locale_id']) { continue; }

                $catture = (isset($r['catture']) && $r['catture'] !== null && $r['catture'] !== '') ? (int) $r['catture'] : null;
                $consumo = (isset($r['consumo_esca_pct']) && $r['consumo_esca_pct'] !== null && $r['consumo_esca_pct'] !== '')
                    ? max(0, min(100, (int) $r['consumo_esca_pct'])) : null;
                $stato = trim((string) ($r['stato_trappola'] ?? 'OK')) ?: 'OK';

                $sel->execute([$id, $pid]);
                $ex = $sel->fetchColumn();
                if ($ex) { $updR->execute([$catture, $consumo, $stato, $ex]); }
                else { $insR->execute([$id, $pid, $catture, $consumo, $stato]); }
                $saved++;
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            json_fail('Errore salvataggio: ' . $e->getMessage(), 500);
        }
        json_ok(['id' => $id, 'rilevazioni' => $saved]);
        break;
    }

    case 'validate': {
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $i = load_intervento_or_403($pdo, $id, $user, true);
        $pdo->prepare("UPDATE interventi SET stato='validato', validato_at=NOW() WHERE id=?")
            ->execute([$id]);
        // Aggiorna il registro IPM/HACCP con gli esiti soglia.
        $superamenti = haccp_log_breaches($pdo, $id, (int) $i['locale_id'], $i['data']);
        json_ok(['id' => $id, 'stato' => 'validato', 'superamenti_haccp' => $superamenti]);
        break;
    }

    case 'delete': {
        require_role('admin', 'supervisore');
        require_method('POST');
        verify_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        $pdo->prepare('DELETE FROM interventi WHERE id = ?')->execute([$id]);
        json_ok(['id' => $id]);
        break;
    }

    default:
        json_fail('Azione non valida', 404);
}

/**
 * Carica un intervento applicando il controllo di accesso per ruolo.
 * Se $needWrite, il cliente non ha accesso (solo lettura altrove) e
 * il tecnico deve essere quello assegnato.
 */
function load_intervento_or_403(PDO $pdo, int $id, array $user, bool $needWrite = false): array
{
    $stmt = $pdo->prepare(
        'SELECT i.*, l.nome AS locale_nome, l.cliente_id, l.indirizzo AS locale_indirizzo,
                c.ragione_sociale AS cliente_nome, c.partita_iva, c.sede_legale, c.riferimento_aziendale, c.email AS cliente_email,
                u.nome AS tecnico_nome
         FROM interventi i
         JOIN locali l ON l.id = i.locale_id
         JOIN clienti c ON c.id = l.cliente_id
         JOIN users u ON u.id = i.tecnico_id
         WHERE i.id = ?'
    );
    $stmt->execute([$id]);
    $i = $stmt->fetch();
    if (!$i) { json_fail('Intervento non trovato', 404); }

    if ($user['ruolo'] === 'tecnico') {
        if ((int) $i['tecnico_id'] !== (int) $user['id']) { json_fail('Permesso negato', 403); }
    } elseif ($user['ruolo'] === 'cliente') {
        if ($needWrite || (int) $i['cliente_id'] !== (int) $user['cliente_id']) { json_fail('Permesso negato', 403); }
    }
    return $i;
}
