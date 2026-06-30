<?php
/**
 * src/soglie.php — calcolo automatico delle soglie come nel report PDF.
 *
 * Per ogni combinazione (area, tipo dispositivo) del locale di un intervento:
 *   - conta le postazioni totali;
 *   - conta quelle con attività (catture > 0 oppure consumo_esca_pct > 0);
 *   - confronta con il limite configurato (tabella soglie);
 *   - esito = 'superato' se attività > limite, altrimenti 'non_superato'.
 */

/**
 * @return array elenco di gruppi:
 *   [ area_id, area_nome, area_tipo, tipo_id, tipo_nome, metrica,
 *     limite, totale, con_attivita, esito ]
 */
function calcola_soglie(PDO $pdo, int $interventoId, int $localeId): array
{
    $sql = '
        SELECT a.id   AS area_id,
               a.nome AS area_nome,
               a.tipo AS area_tipo,
               td.id  AS tipo_id,
               td.nome AS tipo_nome,
               td.metrica,
               COALESCE(s.limite, 1) AS limite,
               COUNT(DISTINCT p.id) AS totale,
               COUNT(DISTINCT CASE
                     WHEN (r.catture > 0 OR r.consumo_esca_pct > 0) THEN p.id END) AS con_attivita
        FROM postazioni p
        JOIN aree a               ON a.id = p.area_id
        JOIN tipi_dispositivo td  ON td.id = p.tipo_dispositivo_id
        LEFT JOIN soglie s        ON s.tipo_dispositivo_id = td.id
        LEFT JOIN rilevazioni_postazione r
               ON r.postazione_id = p.id AND r.intervento_id = ?
        WHERE a.locale_id = ?
        GROUP BY a.id, td.id
        ORDER BY a.tipo, a.nome, td.nome';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$interventoId, $localeId]);

    $rows = $stmt->fetchAll();
    foreach ($rows as &$g) {
        $g['totale']       = (int) $g['totale'];
        $g['con_attivita'] = (int) $g['con_attivita'];
        $g['limite']       = (int) $g['limite'];
        $g['esito']        = $g['con_attivita'] > $g['limite'] ? 'superato' : 'non_superato';
    }
    unset($g);

    return $rows;
}
