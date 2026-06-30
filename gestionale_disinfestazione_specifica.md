# Gestionale per ditta di disinfestazione — guida e specifica funzionale

Documento di studio per Delta Software. Obiettivo: capire cosa deve fare un gestionale di pest control, quali software esistono già (da cui copiare le "maschere"), e l'elenco puntato delle funzionalità del nuovo gestionale, ricavato direttamente dal report PDF del cliente (Deblattizzazione Campania SRLS → 25 Pizza \& Bistrot).

\---

## 1\. I software più importanti sul mercato (da studiare e usare come riferimento UI)

### I più rilevanti per il tuo caso (Europa / HACCP / monitoraggio postazioni)

* **PestScan** (`pestscansolutions.com`) — **il riferimento numero uno per te.** È europeo, nato per lo standard HACCP/IPM (NEN), supporta l'italiano, ha app mobile + software gestionale + portale cliente, lavora con codici a barre/QR sulle postazioni, "logbook digitale" online, soglie (thresholds) per postazione, planimetrie interattive, e si integra con trappole smart (e-Mitter, Xignal, TrapMe). Il report che hai in mano è praticamente un output stile PestScan. Studia la pagina `/features/`.
* **EasyPest** (`easypest.eu`) — **gestionale italiano dedicato** alla disinfestazione/derattizzazione: team, agenda, scadenze, archivio piani HACCP e report, ruoli multiutente, statistiche per area/tipo intervento, GDPR. Utile per vedere come un competitor italiano organizza i moduli.
* **Byron Web** — gestionale italiano usato da ditte come Exera; offre area cliente riservata configurabile.
* **Pest Management App / Formitize** — fortissimi sulla gestione **bait station con QR code**: ogni postazione = un "asset" con QR, storico modifiche, foto con GPS, schede di sicurezza allegate. Esattamente la parte "quante trappole rimangono al cliente".

### I grandi player internazionali (per la tassonomia delle funzionalità e le UI)

* **PestPac** (WorkWave) — enterprise, barcoding postazioni, moduli IPM, compliance pesante.
* **FieldRoutes** (ServiceTitan) — cloud, routing, servizi ricorrenti, portale cliente.
* **GorillaDesk** — piccole/medie imprese, ottimo "device tracking" (traccia trappole/bait station via barcode con lo smartphone). Buon esempio di UI semplice.
* **Briostack**, **Jobber**, **Housecall Pro**, **ServiceTitan** — field service più generici.
* **QuoteIQ**, **Solea** — più recenti, AI-native.

> Consiglio pratico: apri le \*\*demo / free trial\*\* di PestScan, EasyPest e GorillaDesk. Lì vedi le maschere reali (anagrafica, postazione, intervento, report) e puoi clonare la logica invece di reinventarla.

\---

## 2\. Cosa dice il report PDF (mappatura → funzionalità)

Il report del cliente contiene esattamente questi blocchi. Ognuno diventa un pezzo del gestionale:

|Blocco nel PDF|Dati|Diventa nel gestionale|
|-|-|-|
|Cliente|Ragione sociale, Sito logistico, Sede legale, Riferimento aziendale|Anagrafica cliente **multi-sito** (un cliente può avere più siti)|
|Monitoraggio|Data, Tecnico, Tipologia intervento (Programmato)|Anagrafica **intervento**|
|Stato manutenzione|Strutture, Serramenti, Segnalazioni|**Checklist** condizioni struttura|
|Situazione evidenze|Area, Specie rilevate, Evidenze, Fonti infestazione|**Rilevazioni** dell'intervento|
|Aree|Interna / Esterna|**Aree** del sito|
|Dettaglio ubicazione|Ubicazione, Modello trappola, Grado rischio|Configurazione **area + tipo dispositivo**|
|Dettaglio postazioni|Totale postazioni, Limite postazioni (≤1), Postazioni con cattura/consumo, "limite (non) superato"|**Soglie (thresholds)** e calcolo automatico esito|
|Dettagli monitoraggio|N° postazione, Ubicazione, Catture / Consumo esca %, Stato trappola (OK)|**Mappatura postazioni** + rilevazione per postazione|
|Validazione|"report validato dal tecnico … in data"|**Firma/validazione** e workflow stati|
|Header/footer|Logo, P.IVA, "Rev:01 del 01/02/2022", paginazione|**Template report** versionato + dati azienda|

\---

## 3\. Elenco puntato delle funzionalità del nuovo gestionale

### 3.1 Configurazione / Anagrafiche di base (la parte che hai citato: "configurazione servizi")

È il cuore configurabile da cui dipende tutto il resto. Deve permettere all'admin di definire:

* **Servizi / tipi di intervento**: Derattizzazione, Disinfestazione (insetti striscianti/volanti), Allontanamento volatili, Sanificazione, ecc. — ognuno con propria scheda e propri campi.
* **Tipologie intervento**: Programmato, Straordinario/Emergenza, Primo impianto, Sopralluogo.
* **Tipi di dispositivo/postazione**: contenitore con piastra collante, contenitore per esche modello Standard, trappola a cattura multipla, lampada UV, ecc.
* **Modelli di trappola / prodotti** (anche con codice presidio medico-chirurgico).
* **Specie** monitorate (topo, ratto, blatta, ecc.) e relative **evidenze**/fonti di infestazione.
* **Aree** standard (interna, esterna, cucina, magazzino, giardino…).
* **Gradi di rischio** (Rischio minimo / medio / alto) con criteri.
* **Soglie (thresholds)** per servizio/postazione: es. "Limite postazioni ≤ 1" → genera in automatico "limite superato / non superato".
* **Template di report** (per servizio) con logo, intestazione, P.IVA, **versione documento** (Rev. e data), footer, lingue.
* **Anagrafica tecnici** e **clienti**.

### 3.2 Anagrafica clienti

* Cliente con **più siti logistici** (sede legale ≠ sito operativo).
* Referente aziendale, contatti, recapiti, email per invio report.
* **Contratti**: tipo servizio, frequenza (mensile, trimestrale…), durata, canone, allegati.
* Storico completo interventi e documenti per sito.
* Dati per fatturazione e dati GDPR/consensi.

### 3.3 Mappatura postazioni / dispositivi (= "quante trappole rimangono al cliente")

* Ogni postazione = **asset numerato** legato a un sito e a un'area (es. "6 — Sala sotto frigo").
* **Conteggio dispositivi installati per sito** (interne ed esterne separate) → sai sempre quante trappole sono in carico al cliente.
* **QR code / barcode** su ogni postazione: il tecnico scansiona e registra al volo.
* **Planimetria interattiva**: posizione delle postazioni sulla mappa del locale.
* Stato del dispositivo (OK / da sostituire / mancante / manomessa), data installazione, storico modifiche.
* Foto e coordinate GPS della postazione.

### 3.4 Pianificazione interventi

* Agenda/calendario con assegnazione **tecnico** + **sito**.
* **Ricorrenze automatiche** in base alla frequenza contrattuale + notifiche scadenze.
* Ottimizzazione percorsi (route) per chi ha più tecnici.
* Generazione automatica dell'ordine di lavoro.

### 3.5 App tecnico in campo (mobile)

* Lista interventi del giorno, anche **offline** (sincronizza quando torna la rete).
* Scansione postazione → inserimento **catture / consumo esca % / stato trappola**.
* Compilazione **stato manutenzione** (strutture, serramenti) e **rilevazioni** (specie, evidenze, fonti).
* Foto, note, raccomandazioni al cliente.
* **Firma** del tecnico e/o del cliente sul posto → validazione.

### 3.6 Report intervento

* Generazione **PDF automatica** con lo stesso layout del documento attuale (intestazione, tabelle postazioni, esito soglie, validazione, footer con P.IVA e revisione).
* Stati del report: bozza → validato → inviato.
* **Invio automatico via email** al referente appena chiuso l'intervento.
* Archiviazione e ricerca storica.

### 3.7 Portale cliente (logbook digitale)

* Accesso web del cliente al proprio registro: report, postazioni, trend.
* Contratti, certificati, schede di sicurezza prodotti, diplomi/abilitazioni tecnici.
* Trend di consumo/catture nel tempo (grafici), planimetrie.

### 3.8 Magazzino / inventario

* Prodotti, esche, trappole con **lotti** e scadenze.
* Tracciabilità prodotti usati per intervento (utile per HACCP e schede di sicurezza).
* Scorte e riordino.

### 3.9 Dashboard, statistiche e ruoli

* KPI: interventi per area/tecnico, postazioni con superamento soglia, trend infestazioni.
* **Ruoli e permessi**: admin, supervisore, tecnico, cliente.
* Multiutenza.

\---

## 4\. Modello dati di partenza (per te che sviluppi)

Entità principali e relazioni:

* **Cliente** (1) → (N) **Sito**
* **Sito** (1) → (N) **Area** (interna/esterna)
* **Area** (1) → (N) **Postazione** (numerata, tipo dispositivo, QR)
* **Contratto** lega Cliente/Sito a **Servizi** con frequenza
* **Intervento** lega Sito + Tecnico + Data + Tipologia
* **Intervento** (1) → (N) **RilevazionePostazione** (postazione, catture/consumo %, stato)
* **Intervento** (1) → (1) **StatoManutenzione** + (N) **Evidenze**
* **Intervento** (1) → (1) **Report** (PDF, stato, validazione)
* Tabelle di configurazione: TipoServizio, TipoDispositivo, Specie, GradoRischio, Soglia, TemplateReport

Stack coerente con la tua esperienza: PHP (Laravel) o Node + PostgreSQL, app tecnico in PWA/mobile, generazione PDF lato server (es. WeasyPrint, che hai già usato).

\---

## 5\. Dove studiare (link utili)

* **PestScan – funzionalità**: https://pestscansolutions.com/features/ (e scheda dettagliata su GetApp: https://www.getapp.com/industries-software/a/pestscan/)
* **EasyPest (gestionale italiano)**: https://www.easypest.eu/
* **Pest Management App – bait station management (QR)**: https://www.pestmanagementapp.com/features/bait-station-management
* **GorillaDesk – device tracking**: https://gorilladesk.com/features/device-tracking-software/
* **Checklist funzionalità "best pest control software 2026"**: https://www.pestbase.ai/blog/best-pest-control-software-in-2026-what-service-businesses-need e https://www.fieldpie.com/blog/best-pest-control-software-2026/
* **Lato normativo HACCP / monitoraggio infestanti (Italia)**: https://www.exera.it/servizi/haccp/ e https://www.ongarodisinfestazioni.com/it/manuale-haccp/

\---

### MVP suggerito (per partire)

Clienti+siti → postazioni con QR → app tecnico per registrare catture/consumo → generazione report PDF identico all'attuale → invio email. Tutto il resto (portale, magazzino, fatturazione) come moduli successivi.

