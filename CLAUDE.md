CLAUDE.md — Gestionale Disinfestazione

Contesto

Software gestionale per una ditta di disinfestazione/derattizzazione. Gestisce clienti, siti, postazioni (trappole/esche), interventi dei tecnici e report PDF. Lo usano: l'ufficio (admin) da desktop, i tecnici in campo da tablet/telefono, e i clienti tramite un portale di sola lettura.

File di riferimento (mettere nel repo, in `/docs`):

`docs/gestionale\_disinfestazione\_specifica.md` → specifica funzionale completa (moduli, dettagli).

`docs/report\_esempio.pdf` → il report finale deve replicare fedelmente questo layout (intestazione con logo + P.IVA, blocchi Cliente/Monitoraggio, tabelle postazioni, esito soglie "limite superato/non superato", validazione tecnico, footer con revisione e paginazione).

\---

Stack tecnico — VINCOLANTE, non sostituire

Backend: PHP puro (niente framework) and MySQL.

Frontend: HTML + CSS + JavaScript + jQuery. AJAX per tutte le operazioni.

Database: MySQL.

PDF: libreria mPDF.

QR: scansione con la fotocamera del telefono in browser (libreria `html5-qrcode`).

❌ Niente React/Vue/Angular. ❌ Niente ORM pesanti. se vuoi utilizza CND di bootstrap se serve.

\---

Comportamento SPA — IMPORTANTE

L'app è single-page-like: tutte le operazioni CRUD passano da AJAX (`$.ajax`).

Quando si crea / modifica / elimina un record (es. un cliente), NON ricaricare la pagina: si richiama l'endpoint di lista e si ri-renderizzano le card nel container, così la vista risulta aggiornata senza reload.

Ogni endpoint PHP risponde in JSON.

Pattern: una vista = un container `<div>`; dopo un'azione → chiamata AJAX → ridisegno delle card.

\---

UI / UX

la piattaforma deve essere accessibile sia da desktop sia mobile e tablet.

Le liste si mostrano come CARD, non tabelle, solo per gli clienti e la lista dei loro locali da disinfestare, nei casi di elenco/tabelle dei servizi. sara ovviamente una tabella.(stile a blocchi come nel report PDF).

Palette: bianco dominante, minimal, accenti verdi. Molto spazio bianco, bordi leggeri, ombre morbide.

Touch-friendly: bottoni grandi, aree di tap ampie, font leggibile.

Riprodurre lo stile delle schermate in `/docs` (`ui\\\_riferimento\\\_lista.png`, `ui\\\_riferimento\\\_dettaglio.png`). Sono di un altro progetto immobiliare: stesso layout e stesse card, ma adattate al nostro dominio → "Proprietari" diventa "Clienti" e "Immobili" diventa "Locali".

Principi generali

Mobile/tablet first, poi desktop (responsive). Su desktop griglia di card a più colonne (\~4), su mobile 1 colonna.

Tutto a CARD, mai tabelle.

Base bianca e minimal, sfondo pagina grigio-azzurro chiaro, card bianche con bordo leggero e ombra morbida, angoli arrotondati (\~12px).

Accento primario: verde (preferenza del progetto) per link, bottoni principali e badge "Attivo". (Nelle schermate di riferimento l'accento è blu: usiamo il verde mantenendo identico il layout. Avatar circolari ammessi sia blu che verdi.)



\---

Ruoli (v1)

admin / ufficio: gestione completa (clienti, siti, postazioni, pianificazione, configurazione, report).

tecnico: app in campo — interventi del giorno, scansione postazioni, registrazione catture/consumo, foto, firma, genera report.

cliente: portale di sola lettura (storico interventi, report scaricabili, postazioni del proprio sito).

lapp in campo deve essere creates dentro una cartella chiamata frontend e quindi avra tutti gli file per app in campo, e fluibile da teleffono solo quindi ti deve conetratre, inoltre deve sia poteve entrtare del app dallo steso login del administrator. il sistema capira dove portarti o sull app in capo di o sul parte di admin.

\---

Scope v1 (MVP + portale cliente)

Login + gestione ruoli.

Anagrafica clienti multi-sito.

Siti e aree (interna / esterna).

Postazioni numerate con QR (scansione via fotocamera).

Pianificazione interventi (data, tecnico, sito, tipologia).

App tecnico: registra per postazione catture / consumo esca % / stato trappola; stato manutenzione (strutture, serramenti); evidenze (specie, fonti); foto; firma.

Calcolo automatico soglie (es. "Limite postazioni ≤ 1" → "limite superato / non superato").

Generazione report PDF identico all'esempio + invio email al referente.

Portale cliente (lettura).

Fuori scope v1 (NON implementare): ⛔ Conformità / HACCP / normativa (sezione 3.9 della specifica), ⛔ Fatturazione / contabilità (sezione 3.10 della specifica), funzionamento offline, ottimizzazione percorsi, magazzino avanzato.

> ⚠️ Nota: la specifica `docs/gestionale\_disinfestazione\_specifica.md` descrive anche i moduli \*\*3.9 (Conformità/HACCP)\*\* e \*\*3.10 (Fatturazione)\*\*: \*\*ignorali, non vanno costruiti.\*\* Il "Calcolo soglie" al punto 7 resta incluso perché serve al report, non è il modulo HACCP.

\---

Sicurezza — OBBLIGATORIO

PDO con prepared statements ovunque (mai SQL concatenato).

Password con `password\_hash()` / `password\_verify()`.

Auth via sessioni PHP; controllo del ruolo su OGNI endpoint (il tecnico non vede dati di altri clienti, il cliente vede solo il proprio sito).

Token CSRF sulle chiamate AJAX che modificano dati.

Validazione e sanificazione di tutti gli input lato server.

Upload foto: validare tipo/dimensione, salvare fuori dalla webroot o con nomi randomizzati.

\---

Struttura cartelle suggerita

```
/public            → index.php, assets (css, js, img), punto d'ingresso web
/public/api        → endpoint AJAX (es. clienti.php, postazioni.php) che rispondono JSON
/src               → logica PHP (db.php, auth.php, classi/funzioni)
/views             → frammenti HTML/template renderizzati
/vendor            → mPDF (via composer) 
/docs              → specifica .md + report\_esempio.pdf
config.php         → credenziali DB e costanti (fuori dal versioning)
schema.sql         → struttura database
```

\---

Modello dati (MySQL — schema iniziale)

```sql
CREATE TABLE users (
  id INT AUTO\_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password\_hash VARCHAR(255) NOT NULL,
  ruolo ENUM('admin','tecnico','cliente') NOT NULL,
  cliente\_id INT NULL,              -- valorizzato solo se ruolo='cliente'
  attivo TINYINT(1) DEFAULT 1,
  created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP
);

CREATE TABLE clienti (
  id INT AUTO\_INCREMENT PRIMARY KEY,
  ragione\_sociale VARCHAR(190) NOT NULL,
  sede\_legale VARCHAR(255),
  riferimento\_aziendale VARCHAR(150),
  email VARCHAR(190),
  telefono VARCHAR(50),
  created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP
);

CREATE TABLE siti (
  id INT AUTO\_INCREMENT PRIMARY KEY,
  cliente\_id INT NOT NULL,
  nome VARCHAR(190) NOT NULL,        -- es. "Sito logistico"
  indirizzo VARCHAR(255),
  FOREIGN KEY (cliente\_id) REFERENCES clienti(id) ON DELETE CASCADE
);

CREATE TABLE aree (
  id INT AUTO\_INCREMENT PRIMARY KEY,
  sito\_id INT NOT NULL,
  nome VARCHAR(150) NOT NULL,        -- es. "Cucina", "Giardino"
  tipo ENUM('interna','esterna') NOT NULL,
  FOREIGN KEY (sito\_id) REFERENCES siti(id) ON DELETE CASCADE
);

CREATE TABLE tipi\_dispositivo (   -- configurazione
  id INT AUTO\_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,       -- es. "Contenitore con piastra collante"
  metrica ENUM('catture','consumo') NOT NULL  -- come si misura la postazione
);

CREATE TABLE postazioni (
  id INT AUTO\_INCREMENT PRIMARY KEY,
  area\_id INT NOT NULL,
  numero INT NOT NULL,              -- es. 6
  ubicazione VARCHAR(255),          -- es. "Sala sotto frigo"
  tipo\_dispositivo\_id INT NOT NULL,
  qr\_code VARCHAR(100) UNIQUE,      -- codice scansionabile
  grado\_rischio ENUM('minimo','medio','alto') DEFAULT 'minimo',
  attiva TINYINT(1) DEFAULT 1,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  FOREIGN KEY (area\_id) REFERENCES aree(id) ON DELETE CASCADE,
  FOREIGN KEY (tipo\_dispositivo\_id) REFERENCES tipi\_dispositivo(id)
);

CREATE TABLE interventi (
  id INT AUTO\_INCREMENT PRIMARY KEY,
  sito\_id INT NOT NULL,
  tecnico\_id INT NOT NULL,
  data DATE NOT NULL,
  tipologia ENUM('programmato','straordinario','primo\_impianto','sopralluogo') NOT NULL,
  stato\_strutture VARCHAR(50),      -- es. "Accettabile"
  stato\_serramenti VARCHAR(50),
  segnalazioni TEXT,
  stato ENUM('bozza','validato','inviato') DEFAULT 'bozza',
  validato\_at DATETIME NULL,
  FOREIGN KEY (sito\_id) REFERENCES siti(id),
  FOREIGN KEY (tecnico\_id) REFERENCES users(id)
);

CREATE TABLE rilevazioni\_postazione (
  id INT AUTO\_INCREMENT PRIMARY KEY,
  intervento\_id INT NOT NULL,
  postazione\_id INT NOT NULL,
  catture INT NULL,                 -- per dispositivi a cattura
  consumo\_esca\_pct INT NULL,        -- per dispositivi a esca (0-100)
  stato\_trappola VARCHAR(50) DEFAULT 'OK',
  FOREIGN KEY (intervento\_id) REFERENCES interventi(id) ON DELETE CASCADE,
  FOREIGN KEY (postazione\_id) REFERENCES postazioni(id)
);

CREATE TABLE evidenze (
  id INT AUTO\_INCREMENT PRIMARY KEY,
  intervento\_id INT NOT NULL,
  area\_id INT NULL,
  specie\_rilevate VARCHAR(190),
  evidenze VARCHAR(255),
  fonti\_infestazione VARCHAR(255),
  FOREIGN KEY (intervento\_id) REFERENCES interventi(id) ON DELETE CASCADE
);

CREATE TABLE report (
  id INT AUTO\_INCREMENT PRIMARY KEY,
  intervento\_id INT NOT NULL UNIQUE,
  pdf\_path VARCHAR(255),
  inviato\_at DATETIME NULL,
  FOREIGN KEY (intervento\_id) REFERENCES interventi(id) ON DELETE CASCADE
);

CREATE TABLE soglie (              -- configurazione limiti
  id INT AUTO\_INCREMENT PRIMARY KEY,
  tipo\_dispositivo\_id INT NOT NULL,
  limite INT NOT NULL DEFAULT 1,    -- es. ≤ 1 postazione con attività
  FOREIGN KEY (tipo\_dispositivo\_id) REFERENCES tipi\_dispositivo(id)
);
```

\---

Logica soglie (come nel PDF)

Per ogni area/tipo dispositivo di un intervento:

conta le postazioni con attività (catture > 0 oppure consumo\_esca\_pct > 0);

confronta con `soglie.limite`;

se il numero supera il limite → "limite superato" (evidenzia in rosso), altrimenti "limite non superato" (verde).

\---

Ordine di sviluppo consigliato

`schema.sql` + connessione PDO (`config.php`, `src/db.php`).

Auth + ruoli + CSRF.

CRUD clienti (card + AJAX) → da qui si vede subito il pattern SPA.

Siti / aree / postazioni (+ QR).

Scansione QR in browser (`html5-qrcode`).

Interventi + app tecnico.

Calcolo soglie.

Report PDF (mPDF) replicando `docs/report\_esempio.pdf` + invio email.

Portale cliente (lettura).

> Prima di tutto, leggi `docs/gestionale\_disinfestazione\_specifica.md` e apri `docs/report\_esempio.pdf`: il PDF generato deve corrispondere a quel layout.




Terminologia: ho rinominato sito → locale ovunque (tabella locali, FK locale\_id), perché è il termine che usi tu.

Schema aggiornato: clienti ora ha partita\_iva, note\_interne, stato (attivo/inattivo/archiviato); nuova tabella locali con indirizzo, frequenza\_servizio, foto\_path, stato.



