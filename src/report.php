<?php
/**
 * src/report.php — generazione HTML + PDF del report intervento (mPDF).
 * Replica il layout dell'esempio: intestazione con dati azienda + P.IVA,
 * blocchi Cliente/Monitoraggio, manutenzione, evidenze, tabelle postazioni
 * per area, esito soglie, validazione tecnico, footer con revisione.
 */

require_once __DIR__ . '/soglie.php';

/** Carica tutti i dati necessari al report di un intervento. */
function report_data(PDO $pdo, int $interventoId): array
{
    $stmt = $pdo->prepare(
        'SELECT i.*, l.nome AS locale_nome, l.indirizzo AS locale_indirizzo, l.cliente_id,
                c.ragione_sociale, c.partita_iva, c.sede_legale, c.riferimento_aziendale, c.email AS cliente_email,
                u.nome AS tecnico_nome
         FROM interventi i
         JOIN locali l ON l.id = i.locale_id
         JOIN clienti c ON c.id = l.cliente_id
         JOIN users u ON u.id = i.tecnico_id
         WHERE i.id = ?'
    );
    $stmt->execute([$interventoId]);
    $i = $stmt->fetch();
    if (!$i) { return []; }

    $stmt = $pdo->prepare(
        'SELECT p.numero, p.ubicazione, p.grado_rischio,
                a.nome AS area_nome, a.tipo AS area_tipo,
                td.nome AS tipo_nome, td.metrica,
                r.catture, r.consumo_esca_pct, r.stato_trappola
         FROM postazioni p
         JOIN aree a ON a.id = p.area_id
         JOIN tipi_dispositivo td ON td.id = p.tipo_dispositivo_id
         LEFT JOIN rilevazioni_postazione r ON r.postazione_id = p.id AND r.intervento_id = ?
         WHERE a.locale_id = ? AND p.attiva = 1
         ORDER BY a.tipo, a.nome, p.numero'
    );
    $stmt->execute([$interventoId, $i['locale_id']]);
    $i['postazioni'] = $stmt->fetchAll();

    $stmt = $pdo->prepare(
        'SELECT e.*, a.nome AS area_nome FROM evidenze e
         LEFT JOIN aree a ON a.id = e.area_id WHERE e.intervento_id = ? ORDER BY e.id'
    );
    $stmt->execute([$interventoId]);
    $i['evidenze'] = $stmt->fetchAll();

    $i['soglie'] = calcola_soglie($pdo, $interventoId, (int) $i['locale_id']);
    return $i;
}

/** Costruisce l'HTML del report. */
function report_html(array $i): string
{
    $esc = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');

    // Raggruppa postazioni per area
    $aree = [];
    foreach ($i['postazioni'] as $p) {
        $aree[$p['area_nome'] . '|' . $p['area_tipo']][] = $p;
    }

    // Indice soglie per area+tipo (per esito tabella)
    $esiti = [];
    foreach ($i['soglie'] as $g) {
        $esiti[$g['area_nome'] . '|' . $g['tipo_id']] = $g;
    }

    ob_start();
    ?>
    <style>
      body { font-family: sans-serif; color: #1f2933; font-size: 10pt; }
      .hdr { width: 100%; border-bottom: 2px solid #1f9d55; padding-bottom: 8px; }
      .hdr td { vertical-align: middle; }
      .logo { width: 46px; height: 46px; background: #1f9d55; color: #fff; font-weight: bold;
              font-size: 22px; text-align: center; border-radius: 8px; }
      .az-nome { font-size: 13pt; font-weight: bold; }
      .az-meta { color: #6b7785; font-size: 8.5pt; }
      h2 { font-size: 12pt; margin: 16px 0 6px; color: #18794a; }
      .block { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; }
      .block table { width: 100%; }
      .block td { padding: 2px 4px; font-size: 9.5pt; }
      .k { color: #6b7785; width: 32%; }
      table.data { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
      table.data th { background: #f0f5f2; color: #18794a; font-size: 8.5pt; text-align: left;
                      padding: 5px 6px; border: 1px solid #d8e2dc; }
      table.data td { padding: 5px 6px; border: 1px solid #e2e8f0; font-size: 9pt; }
      .area-h { background: #e8f6ee; padding: 5px 8px; font-weight: bold; border-radius: 4px; margin-top: 10px; }
      .esito-ok { color: #18794a; font-weight: bold; }
      .esito-ko { color: #d64545; font-weight: bold; }
      .badge-ko { background: #fdecec; color: #d64545; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
      .badge-ok { background: #e8f6ee; color: #18794a; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
      .valid { margin-top: 18px; padding: 10px; border: 1px dashed #1f9d55; border-radius: 6px; background: #f5fbf7; }
    </style>

    <table class="hdr"><tr>
      <td style="width:54px"><div class="logo">D</div></td>
      <td>
        <div class="az-nome"><?= $esc(AZIENDA_NOME) ?></div>
        <div class="az-meta"><?= $esc(AZIENDA_INDIRIZZO) ?> · P.IVA <?= $esc(AZIENDA_PIVA) ?> · <?= $esc(AZIENDA_EMAIL) ?></div>
      </td>
      <td style="text-align:right">
        <div style="font-weight:bold">RAPPORTO DI MONITORAGGIO</div>
        <div class="az-meta">N° intervento <?= (int) $i['id'] ?></div>
      </td>
    </tr></table>

    <table style="width:100%; margin-top:10px"><tr>
      <td style="width:50%; vertical-align:top; padding-right:6px">
        <h2>Cliente</h2>
        <div class="block"><table>
          <tr><td class="k">Ragione sociale</td><td><?= $esc($i['ragione_sociale']) ?></td></tr>
          <tr><td class="k">Sito / locale</td><td><?= $esc($i['locale_nome']) ?><?= $i['locale_indirizzo'] ? ' — ' . $esc($i['locale_indirizzo']) : '' ?></td></tr>
          <tr><td class="k">Sede legale</td><td><?= $esc($i['sede_legale']) ?></td></tr>
          <tr><td class="k">Riferimento</td><td><?= $esc($i['riferimento_aziendale']) ?></td></tr>
          <tr><td class="k">P.IVA</td><td><?= $esc($i['partita_iva']) ?></td></tr>
        </table></div>
      </td>
      <td style="width:50%; vertical-align:top; padding-left:6px">
        <h2>Monitoraggio</h2>
        <div class="block"><table>
          <tr><td class="k">Data</td><td><?= $esc($i['data']) ?></td></tr>
          <tr><td class="k">Tecnico</td><td><?= $esc($i['tecnico_nome']) ?></td></tr>
          <tr><td class="k">Tipologia</td><td><?= $esc(ucfirst($i['tipologia'])) ?></td></tr>
          <tr><td class="k">Stato</td><td><?= $esc(ucfirst($i['stato'])) ?></td></tr>
        </table></div>
      </td>
    </tr></table>

    <h2>Stato manutenzione</h2>
    <div class="block"><table>
      <tr><td class="k">Strutture</td><td><?= $esc($i['stato_strutture'] ?: '—') ?></td>
          <td class="k">Serramenti</td><td><?= $esc($i['stato_serramenti'] ?: '—') ?></td></tr>
      <tr><td class="k">Segnalazioni</td><td colspan="3"><?= $esc($i['segnalazioni'] ?: '—') ?></td></tr>
    </table></div>

    <?php if (!empty($i['evidenze'])): ?>
      <h2>Situazione evidenze</h2>
      <table class="data">
        <tr><th>Area</th><th>Specie rilevate</th><th>Evidenze</th><th>Fonti infestazione</th></tr>
        <?php foreach ($i['evidenze'] as $e): ?>
          <tr>
            <td><?= $esc($e['area_nome'] ?: 'Generale') ?></td>
            <td><?= $esc($e['specie_rilevate']) ?></td>
            <td><?= $esc($e['evidenze']) ?></td>
            <td><?= $esc($e['fonti_infestazione']) ?></td>
          </tr>
        <?php endforeach; ?>
      </table>
    <?php endif; ?>

    <h2>Dettaglio postazioni</h2>
    <?php foreach ($aree as $key => $lista):
        [$areaNome, $areaTipo] = explode('|', $key); ?>
      <div class="area-h"><?= $esc($areaNome) ?> — <?= $esc(ucfirst($areaTipo)) ?></div>
      <table class="data">
        <tr><th>N°</th><th>Ubicazione</th><th>Dispositivo</th><th>Rischio</th><th>Catture / Consumo</th><th>Stato</th></tr>
        <?php foreach ($lista as $p):
            $ril = $p['metrica'] === 'consumo'
                ? (($p['consumo_esca_pct'] !== null) ? 'consumo ' . (int) $p['consumo_esca_pct'] . '%' : '—')
                : (($p['catture'] !== null) ? 'catture ' . (int) $p['catture'] : '—'); ?>
          <tr>
            <td><?= (int) $p['numero'] ?></td>
            <td><?= $esc($p['ubicazione']) ?></td>
            <td><?= $esc($p['tipo_nome']) ?></td>
            <td><?= $esc($p['grado_rischio']) ?></td>
            <td><?= $esc($ril) ?></td>
            <td><?= $esc($p['stato_trappola'] ?: 'OK') ?></td>
          </tr>
        <?php endforeach; ?>
      </table>
    <?php endforeach; ?>

    <h2>Esito soglie</h2>
    <table class="data">
      <tr><th>Area</th><th>Dispositivo</th><th>Totale postazioni</th><th>Limite</th><th>Con attività</th><th>Esito</th></tr>
      <?php foreach ($i['soglie'] as $g):
          $ko = $g['esito'] === 'superato'; ?>
        <tr>
          <td><?= $esc($g['area_nome']) ?></td>
          <td><?= $esc($g['tipo_nome']) ?></td>
          <td><?= (int) $g['totale'] ?></td>
          <td>&le; <?= (int) $g['limite'] ?></td>
          <td><?= (int) $g['con_attivita'] ?></td>
          <td><span class="<?= $ko ? 'badge-ko' : 'badge-ok' ?>"><?= $ko ? 'Limite superato' : 'Limite non superato' ?></span></td>
        </tr>
      <?php endforeach; ?>
    </table>

    <div class="valid">
      <?php if (in_array($i['stato'], ['validato', 'inviato'], true)):
          $dataVal = $i['validato_at'] ?: $i['data']; ?>
        Report validato dal tecnico <strong><?= $esc($i['tecnico_nome']) ?></strong> in data <?= $esc($dataVal) ?>.
      <?php else: ?>
        <em>Report non ancora validato dal tecnico.</em>
      <?php endif; ?>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Genera (o rigenera) il PDF, lo salva su disco e aggiorna la tabella report.
 * @return string percorso del file PDF
 */
function genera_report_pdf(PDO $pdo, int $interventoId): string
{
    $i = report_data($pdo, $interventoId);
    if (!$i) { throw new RuntimeException('Intervento non trovato'); }

    if (!is_dir(REPORT_PATH)) { mkdir(REPORT_PATH, 0775, true); }
    $file = REPORT_PATH . '/report_intervento_' . $interventoId . '.pdf';

    $mpdf = new \Mpdf\Mpdf([
        'mode' => 'utf-8', 'format' => 'A4',
        'margin_top' => 30, 'margin_bottom' => 20,
        'tempDir' => sys_get_temp_dir(),
    ]);
    $mpdf->SetTitle('Report intervento ' . $interventoId);

    $footer = '<table width="100%" style="font-size:8pt;color:#6b7785;border-top:1px solid #e2e8f0">'
        . '<tr><td>' . htmlspecialchars(AZIENDA_NOME) . ' — ' . htmlspecialchars(REPORT_REV) . '</td>'
        . '<td style="text-align:right">Pag. {PAGENO}/{nbpg}</td></tr></table>';
    $mpdf->SetHTMLFooter($footer);

    $mpdf->WriteHTML(report_html($i));
    $mpdf->Output($file, \Mpdf\Output\Destination::FILE);

    // upsert tabella report
    $stmt = $pdo->prepare('SELECT id FROM report WHERE intervento_id = ?');
    $stmt->execute([$interventoId]);
    if ($stmt->fetch()) {
        $pdo->prepare('UPDATE report SET pdf_path = ? WHERE intervento_id = ?')->execute([$file, $interventoId]);
    } else {
        $pdo->prepare('INSERT INTO report (intervento_id, pdf_path) VALUES (?,?)')->execute([$interventoId, $file]);
    }

    return $file;
}

/**
 * Invia il report via email al referente del cliente (best-effort).
 * @return array [bool sent, string note]
 */
function invia_report_email(PDO $pdo, int $interventoId, string $pdfPath): array
{
    $i = report_data($pdo, $interventoId);
    $to = $i['cliente_email'] ?? '';
    if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return [false, 'Il cliente non ha un indirizzo email valido.'];
    }
    if (!is_file($pdfPath)) {
        return [false, 'PDF non trovato.'];
    }

    $boundary = md5(uniqid((string) $interventoId, true));
    $subject  = 'Report intervento del ' . $i['data'] . ' - ' . $i['locale_nome'];
    $headers  = 'From: ' . AZIENDA_NOME . ' <' . REPORT_MITTENTE . ">\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= 'Content-Type: multipart/mixed; boundary="' . $boundary . "\"\r\n";

    $body  = '--' . $boundary . "\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
    $body .= "Gentile " . ($i['riferimento_aziendale'] ?: 'Cliente') . ",\r\n\r\n";
    $body .= "in allegato il report dell'intervento di monitoraggio del " . $i['data'] . ".\r\n\r\n";
    $body .= AZIENDA_NOME . "\r\n" . AZIENDA_TEL . "\r\n\r\n";
    $body .= '--' . $boundary . "\r\n";
    $body .= "Content-Type: application/pdf; name=\"report.pdf\"\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n";
    $body .= "Content-Disposition: attachment; filename=\"report_intervento_" . $interventoId . ".pdf\"\r\n\r\n";
    $body .= chunk_split(base64_encode(file_get_contents($pdfPath))) . "\r\n";
    $body .= '--' . $boundary . "--";

    $sent = @mail($to, $subject, $body, $headers);
    if ($sent) {
        return [true, 'Email inviata a ' . $to];
    }
    return [false, 'Server email non configurato (mail() non disponibile in locale). PDF comunque salvato.'];
}
