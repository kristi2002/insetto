<?php
/**
 * src/haccp.php — registro IPM/HACCP: logging dei superamenti soglia.
 * Si appoggia a calcola_soglie() (src/soglie.php).
 */

require_once __DIR__ . '/soglie.php';

/**
 * Ricalcola le soglie di un intervento e aggiorna il registro HACCP.
 * Rimuove le righe esistenti per quell'intervento e ne inserisce di nuove
 * (una per gruppo area/tipo dispositivo). Restituisce il numero di
 * superamenti registrati.
 */
function haccp_log_breaches(PDO $pdo, int $interventoId, int $localeId, string $data): int
{
    $gruppi = calcola_soglie($pdo, $interventoId, $localeId);

    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM haccp_log WHERE intervento_id = ?')->execute([$interventoId]);

        $ins = $pdo->prepare(
            'INSERT INTO haccp_log
               (intervento_id, area_id, tipo_dispositivo_id, data, totale_postazioni, con_attivita, limite, esito, note)
             VALUES (?,?,?,?,?,?,?,?,?)'
        );
        $superamenti = 0;
        foreach ($gruppi as $g) {
            if ($g['esito'] === 'superato') { $superamenti++; }
            $ins->execute([
                $interventoId,
                $g['area_id'],
                $g['tipo_id'],
                $data,
                $g['totale'],
                $g['con_attivita'],
                $g['limite'],
                $g['esito'],
                $g['area_nome'] . ' · ' . $g['tipo_nome'],
            ]);
        }
        $pdo->commit();
        return $superamenti;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/**
 * Estrae il registro HACCP con filtri opzionali.
 * @param array $f  [cliente_id, locale_id, esito, from, to]
 */
function haccp_registro(PDO $pdo, array $f = []): array
{
    $sql = 'SELECT h.*, i.locale_id, l.nome AS locale_nome, c.id AS cliente_id, c.ragione_sociale AS cliente_nome,
                   a.nome AS area_nome, td.nome AS tipo_nome, u.nome AS tecnico_nome
            FROM haccp_log h
            JOIN interventi i ON i.id = h.intervento_id
            JOIN locali l ON l.id = i.locale_id
            JOIN clienti c ON c.id = l.cliente_id
            JOIN users u ON u.id = i.tecnico_id
            LEFT JOIN aree a ON a.id = h.area_id
            LEFT JOIN tipi_dispositivo td ON td.id = h.tipo_dispositivo_id
            WHERE 1=1';
    $args = [];
    if (!empty($f['cliente_id'])) { $sql .= ' AND c.id = ?'; $args[] = (int) $f['cliente_id']; }
    if (!empty($f['locale_id'])) { $sql .= ' AND i.locale_id = ?'; $args[] = (int) $f['locale_id']; }
    if (!empty($f['esito'])) { $sql .= ' AND h.esito = ?'; $args[] = $f['esito']; }
    if (!empty($f['from'])) { $sql .= ' AND h.data >= ?'; $args[] = $f['from']; }
    if (!empty($f['to'])) { $sql .= ' AND h.data <= ?'; $args[] = $f['to']; }
    $sql .= ' ORDER BY h.data DESC, h.id DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($args);
    return $stmt->fetchAll();
}
