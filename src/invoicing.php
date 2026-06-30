<?php
/**
 * src/invoicing.php — preventivi e fatture, calcolo totali e generazione
 * XML in stile FatturaPA (SDI). L'XML è un sottoinsieme valido e ben formato
 * dei campi principali: non è firmato digitalmente né trasmesso allo SDI
 * (operazione che richiede un canale accreditato).
 */

/** Numero progressivo per tipo/anno (formato "NNNN/AAAA"). */
function prossimo_numero(PDO $pdo, string $tipo, int $anno): string
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM documenti WHERE tipo = ? AND anno = ?');
    $stmt->execute([$tipo, $anno]);
    $n = (int) $stmt->fetchColumn() + 1;
    return str_pad((string) $n, 4, '0', STR_PAD_LEFT) . '/' . $anno;
}

/**
 * Ricalcola e salva i totali di un documento a partire dalle sue righe.
 * @return array [imponibile, iva, totale]
 */
function ricalcola_totali(PDO $pdo, int $documentoId): array
{
    $stmt = $pdo->prepare('SELECT quantita, prezzo_unitario, aliquota_iva FROM documento_righe WHERE documento_id = ?');
    $stmt->execute([$documentoId]);
    $righe = $stmt->fetchAll();

    $imponibile = 0.0; $iva = 0.0;
    foreach ($righe as $r) {
        $imp = round((float) $r['quantita'] * (float) $r['prezzo_unitario'], 2);
        $imponibile += $imp;
        $iva += round($imp * (float) $r['aliquota_iva'] / 100, 2);
    }
    $imponibile = round($imponibile, 2);
    $iva = round($iva, 2);
    $totale = round($imponibile + $iva, 2);

    $pdo->prepare('UPDATE documenti SET imponibile=?, iva=?, totale=? WHERE id=?')
        ->execute([$imponibile, $iva, $totale, $documentoId]);

    return [$imponibile, $iva, $totale];
}

/** Aggiorna l'importo di ogni riga (quantita*prezzo). */
function ricalcola_righe(PDO $pdo, int $documentoId): void
{
    $stmt = $pdo->prepare('SELECT id, quantita, prezzo_unitario FROM documento_righe WHERE documento_id = ?');
    $stmt->execute([$documentoId]);
    foreach ($stmt->fetchAll() as $r) {
        $imp = round((float) $r['quantita'] * (float) $r['prezzo_unitario'], 2);
        $pdo->prepare('UPDATE documento_righe SET importo=? WHERE id=?')->execute([$imp, $r['id']]);
    }
}

/** Carica documento completo (testata + cliente + righe). */
function documento_completo(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare(
        'SELECT d.*, c.ragione_sociale, c.partita_iva, c.codice_fiscale, c.codice_sdi, c.pec, c.sede_legale
         FROM documenti d JOIN clienti c ON c.id = d.cliente_id WHERE d.id = ?'
    );
    $stmt->execute([$id]);
    $d = $stmt->fetch();
    if (!$d) { return null; }
    $stmt = $pdo->prepare('SELECT * FROM documento_righe WHERE documento_id = ? ORDER BY id');
    $stmt->execute([$id]);
    $d['righe'] = $stmt->fetchAll();
    return $d;
}

/**
 * Genera l'XML FatturaPA (sottoinsieme) e lo salva su disco.
 * @return string percorso del file XML
 */
function genera_xml_sdi(PDO $pdo, int $documentoId): string
{
    $d = documento_completo($pdo, $documentoId);
    if (!$d) { throw new RuntimeException('Documento non trovato'); }
    if ($d['tipo'] !== 'fattura') { throw new RuntimeException('Solo le fatture generano XML SDI'); }

    $esc = fn($v) => htmlspecialchars((string) $v, ENT_XML1, 'UTF-8');
    $num = (float) 0;

    // Raggruppa per aliquota per i DatiRiepilogo
    $riepilogo = [];
    foreach ($d['righe'] as $r) {
        $al = number_format((float) $r['aliquota_iva'], 2, '.', '');
        $imp = round((float) $r['quantita'] * (float) $r['prezzo_unitario'], 2);
        if (!isset($riepilogo[$al])) { $riepilogo[$al] = ['imponibile' => 0.0]; }
        $riepilogo[$al]['imponibile'] += $imp;
    }

    $codiceDest = $d['codice_sdi'] ?: '0000000';      // 7 caratteri
    $pivaCliente = $d['partita_iva'] ?: '';
    $cfCliente = $d['codice_fiscale'] ?: '';

    // Righe dettaglio
    $linee = '';
    $nr = 0;
    foreach ($d['righe'] as $r) {
        $nr++;
        $prezzoTot = number_format(round((float) $r['quantita'] * (float) $r['prezzo_unitario'], 2), 2, '.', '');
        $linee .= '
        <DettaglioLinee>
          <NumeroLinea>' . $nr . '</NumeroLinea>
          <Descrizione>' . $esc($r['descrizione']) . '</Descrizione>
          <Quantita>' . number_format((float) $r['quantita'], 2, '.', '') . '</Quantita>
          <PrezzoUnitario>' . number_format((float) $r['prezzo_unitario'], 2, '.', '') . '</PrezzoUnitario>
          <PrezzoTotale>' . $prezzoTot . '</PrezzoTotale>
          <AliquotaIVA>' . number_format((float) $r['aliquota_iva'], 2, '.', '') . '</AliquotaIVA>
        </DettaglioLinee>';
    }

    $datiRiepilogo = '';
    foreach ($riepilogo as $al => $info) {
        $imp = round($info['imponibile'], 2);
        $imposta = round($imp * (float) $al / 100, 2);
        $datiRiepilogo .= '
        <DatiRiepilogo>
          <AliquotaIVA>' . number_format((float) $al, 2, '.', '') . '</AliquotaIVA>
          <ImponibileImporto>' . number_format($imp, 2, '.', '') . '</ImponibileImporto>
          <Imposta>' . number_format($imposta, 2, '.', '') . '</Imposta>
        </DatiRiepilogo>';
    }

    $xml = '<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>' . $esc(AZIENDA_PAESE) . '</IdPaese><IdCodice>' . $esc(AZIENDA_PIVA) . '</IdCodice></IdTrasmittente>
      <ProgressivoInvio>' . $esc($d['id']) . '</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>' . $esc($codiceDest) . '</CodiceDestinatario>
      ' . ($d['pec'] ? '<PECDestinatario>' . $esc($d['pec']) . '</PECDestinatario>' : '') . '
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>' . $esc(AZIENDA_PAESE) . '</IdPaese><IdCodice>' . $esc(AZIENDA_PIVA) . '</IdCodice></IdFiscaleIVA>
        <CodiceFiscale>' . $esc(AZIENDA_CF) . '</CodiceFiscale>
        <Anagrafica><Denominazione>' . $esc(AZIENDA_NOME) . '</Denominazione></Anagrafica>
        <RegimeFiscale>' . $esc(AZIENDA_REGIME) . '</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>' . $esc(AZIENDA_INDIRIZZO_VIA) . '</Indirizzo>
        <CAP>' . $esc(AZIENDA_CAP) . '</CAP>
        <Comune>' . $esc(AZIENDA_COMUNE) . '</Comune>
        <Provincia>' . $esc(AZIENDA_PROVINCIA) . '</Provincia>
        <Nazione>' . $esc(AZIENDA_PAESE) . '</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        ' . ($pivaCliente ? '<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>' . $esc($pivaCliente) . '</IdCodice></IdFiscaleIVA>' : '') . '
        ' . ($cfCliente ? '<CodiceFiscale>' . $esc($cfCliente) . '</CodiceFiscale>' : '') . '
        <Anagrafica><Denominazione>' . $esc($d['ragione_sociale']) . '</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>' . $esc($d['sede_legale'] ?: '-') . '</Indirizzo>
        <CAP>00000</CAP>
        <Comune>-</Comune>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>' . $esc($d['data']) . '</Data>
        <Numero>' . $esc($d['numero']) . '</Numero>
        <ImportoTotaleDocumento>' . number_format((float) $d['totale'], 2, '.', '') . '</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>' . $linee . $datiRiepilogo . '
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>
';

    if (!is_dir(REPORT_PATH)) { mkdir(REPORT_PATH, 0775, true); }
    $dir = dirname(REPORT_PATH) . '/sdi';
    if (!is_dir($dir)) { mkdir($dir, 0775, true); }
    $file = $dir . '/fattura_' . $documentoId . '.xml';
    file_put_contents($file, $xml);

    $pdo->prepare('UPDATE documenti SET xml_path = ? WHERE id = ?')->execute([$file, $documentoId]);
    return $file;
}
