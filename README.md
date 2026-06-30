# Gestionale Disinfestazione

Software gestionale per ditta di disinfestazione/derattizzazione.
Stack **vincolante**: PHP puro + MySQL, frontend HTML/CSS/JS + jQuery (AJAX), PDF con mPDF, scansione QR con `html5-qrcode`.

## Requisiti
- XAMPP (Apache + MySQL + PHP 8) — il progetto vive in `C:\XAMPP\htdocs\insetto`
- Estensione PHP **gd** abilitata (richiesta da mPDF) → in `C:\XAMPP\php\php.ini` la riga `extension=gd` deve essere **non** commentata
- mPDF installato in `/vendor` (via Composer)

## Setup
```bash
# 1. Crea database e tabelle (base)
C:\XAMPP\mysql\bin\mysql.exe -u root < schema.sql

# 1b. Estensioni: Inventario, HACCP, Fatturazione SDI, ruolo supervisore
C:\XAMPP\mysql\bin\mysql.exe -u root < schema_v2.sql

# 2. Dipendenze PHP (mPDF) — gia' installate in /vendor
C:\XAMPP\php\php.exe composer.phar install

# 3. Popola utenti e configurazione di base
C:\XAMPP\php\php.exe seed.php
```
Poi apri: **http://localhost/insetto/** → redirige al login.

## Credenziali di default (create da `seed.php`)
| Ruolo       | Email                        | Password    |
|-------------|------------------------------|-------------|
| admin       | admin@deltasoftware.it       | admin123    |
| supervisore | super@deltasoftware.it       | super123    |
| tecnico     | tecnico@deltasoftware.it     | tecnico123  |

I 4 ruoli (RBAC in `src/rbac.php`):
- **admin**: tutto, inclusa la gestione utenti.
- **supervisore**: gestione operativa completa (clienti, locali, interventi, magazzino, HACCP, fatturazione, dashboard) **tranne** la gestione utenti.
- **tecnico**: app in campo + registrazione consumi di magazzino sui propri interventi.
- **cliente**: sola lettura dei propri dati.

> Cambiare le password dopo il primo accesso. Gli account **cliente** si creano
> dal gestionale (sezione *Utenti*) associandoli a un cliente.

## Struttura
```
/public            punto d'ingresso web (login, gestionale admin, portale cliente)
/public/api        endpoint AJAX (JSON)
/public/assets     css, js (core + viste)
/frontend          app in campo per i tecnici (mobile, scansione QR)
/src               logica PHP (db, auth, helpers, soglie, report)
/vendor            mPDF (Composer)
/storage           upload foto + report PDF (non accessibili via web)
config.php         credenziali DB e costanti azienda (fuori dal versioning)
schema.sql         struttura database
seed.php           dati iniziali
```

## Ruoli e instradamento (login unico)
Lo stesso login smista in base al ruolo:
- **admin** → `/public/index.php` (gestionale completo)
- **tecnico** → `/frontend/` (app in campo)
- **cliente** → `/public/portale.php` (sola lettura)

## Moduli implementati
1. Schema DB + connessione PDO
2. Auth, ruoli e CSRF (sessioni PHP)
3. Anagrafica clienti (card + AJAX)
4. Locali → aree → postazioni numerate con QR
5. Scansione QR in campo (`html5-qrcode`)
6. Pianificazione interventi + app tecnico (rilevazioni, manutenzione, evidenze, validazione)
7. Configurazione tipi dispositivo + calcolo automatico soglie
8. Report PDF (mPDF) con layout dedicato + invio email
9. Portale cliente (sola lettura: storico interventi, report, postazioni)

## Estensioni v2 (oltre l'MVP)
- **Inventario/Magazzino**: articoli, lotti, scadenze, soglia di riordino, alert; consumo prodotti per intervento (scarico FEFO). API `magazzino.php`, viste *Magazzino*.
- **HACCP/IPM**: registro automatico dei superamenti soglia (popolato alla validazione dell'intervento). API `haccp.php`, vista *HACCP*.
- **Fatturazione SDI**: preventivi e fatture con righe, calcolo imponibile/IVA/totale, generazione **XML FatturaPA** (sottoinsieme dei campi, *non firmato/trasmesso*). API `documenti.php`, vista *Fatture*.
- **Dashboard KPI**: interventi per tecnico/area, postazioni oltre soglia, trend infestazioni. API `dashboard.php`, vista *Dashboard*.
- **RBAC** a 4 ruoli centralizzato in `src/rbac.php` (`require_can('area.azione')`).

## Sicurezza
- PDO con prepared statement ovunque
- Password con `password_hash()` / `password_verify()`
- Controllo del ruolo su ogni endpoint; il cliente vede solo i propri dati
- Token CSRF (`X-CSRF-Token`) su tutte le chiamate che modificano dati
- `.htaccess` nega l'accesso diretto a `config.php`, `schema.sql`, `/src`, `/storage`, `/vendor`

## Note
- L'invio email del report usa `mail()`: in locale (XAMPP senza SMTP) non parte,
  ma il PDF viene comunque generato e salvato. In produzione configurare un SMTP.
- I file di riferimento `docs/report_esempio.pdf` e le immagini UI non erano forniti:
  il layout del report replica la struttura descritta nella specifica.
