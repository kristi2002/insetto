<?php
/**
 * src/inventory.php — logica magazzino: giacenze, lotti, scadenze,
 * alert di riordino e tracciamento consumo prodotti per intervento.
 */

/** Giacenza totale di un articolo = somma quantità residue dei lotti. */
function stock_articolo(PDO $pdo, int $articoloId): float
{
    $stmt = $pdo->prepare('SELECT COALESCE(SUM(quantita_residua),0) FROM lotti WHERE articolo_id = ?');
    $stmt->execute([$articoloId]);
    return (float) $stmt->fetchColumn();
}

/**
 * Elenco articoli con giacenza calcolata e flag sotto-soglia.
 */
function articoli_con_giacenza(PDO $pdo): array
{
    $sql = 'SELECT a.*,
                   COALESCE((SELECT SUM(l.quantita_residua) FROM lotti l WHERE l.articolo_id = a.id),0) AS giacenza
            FROM articoli a ORDER BY a.nome';
    $rows = $pdo->query($sql)->fetchAll();
    foreach ($rows as &$r) {
        $r['giacenza'] = (float) $r['giacenza'];
        $r['soglia_riordino'] = (float) $r['soglia_riordino'];
        $r['sotto_soglia'] = $r['giacenza'] <= $r['soglia_riordino'];
    }
    unset($r);
    return $rows;
}

/** Articoli da riordinare (giacenza <= soglia, articolo attivo). */
function reorder_alerts(PDO $pdo): array
{
    return array_values(array_filter(articoli_con_giacenza($pdo), function ($a) {
        return $a['attivo'] && $a['sotto_soglia'];
    }));
}

/** Lotti in scadenza entro $giorni (default 60), con residuo > 0. */
function lotti_in_scadenza(PDO $pdo, int $giorni = 60): array
{
    $stmt = $pdo->prepare(
        'SELECT l.*, a.nome AS articolo_nome, a.unita,
                DATEDIFF(l.scadenza, CURDATE()) AS giorni_alla_scadenza
         FROM lotti l JOIN articoli a ON a.id = l.articolo_id
         WHERE l.scadenza IS NOT NULL AND l.quantita_residua > 0
           AND l.scadenza <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
         ORDER BY l.scadenza ASC'
    );
    $stmt->execute([$giorni]);
    return $stmt->fetchAll();
}

/**
 * Registra il consumo di un prodotto in un intervento e scarica il lotto.
 * Se $lottoId è null, scarica automaticamente dai lotti in scadenza (FEFO).
 * @return int id del consumo
 */
function registra_consumo(PDO $pdo, int $interventoId, int $articoloId, ?int $lottoId, float $quantita): int
{
    if ($quantita <= 0) {
        throw new InvalidArgumentException('Quantità non valida');
    }

    $pdo->beginTransaction();
    try {
        // Selezione lotto: esplicito oppure FEFO (first-expired-first-out).
        if ($lottoId) {
            $stmt = $pdo->prepare('SELECT * FROM lotti WHERE id = ? AND articolo_id = ? FOR UPDATE');
            $stmt->execute([$lottoId, $articoloId]);
            $lotto = $stmt->fetch();
        } else {
            $stmt = $pdo->prepare(
                'SELECT * FROM lotti WHERE articolo_id = ? AND quantita_residua > 0
                 ORDER BY (scadenza IS NULL), scadenza ASC LIMIT 1 FOR UPDATE'
            );
            $stmt->execute([$articoloId]);
            $lotto = $stmt->fetch();
        }

        $lottoUsato = $lotto['id'] ?? null;
        if ($lotto) {
            $nuovo = max(0, (float) $lotto['quantita_residua'] - $quantita);
            $pdo->prepare('UPDATE lotti SET quantita_residua = ? WHERE id = ?')
                ->execute([$nuovo, $lotto['id']]);
        }

        $pdo->prepare(
            'INSERT INTO consumi_intervento (intervento_id, articolo_id, lotto_id, quantita) VALUES (?,?,?,?)'
        )->execute([$interventoId, $articoloId, $lottoUsato, $quantita]);
        $id = (int) $pdo->lastInsertId();

        $pdo->commit();
        return $id;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/** Consumi registrati su un intervento (con nomi). */
function consumi_intervento(PDO $pdo, int $interventoId): array
{
    $stmt = $pdo->prepare(
        'SELECT ci.*, a.nome AS articolo_nome, a.unita, l.codice_lotto
         FROM consumi_intervento ci
         JOIN articoli a ON a.id = ci.articolo_id
         LEFT JOIN lotti l ON l.id = ci.lotto_id
         WHERE ci.intervento_id = ? ORDER BY ci.id'
    );
    $stmt->execute([$interventoId]);
    return $stmt->fetchAll();
}
