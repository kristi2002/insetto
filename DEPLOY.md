# Deploy su Hetzner + Coolify

Guida passo-passo per pubblicare il **Gestionale Disinfestazione** su un server
Hetzner Cloud gestito con **Coolify**, usando un repository Git e un database
**MariaDB** gestito da Coolify.

> ⚠️ **Usa MariaDB, NON MySQL 8.** Il file `schema_v2.sql` usa
> `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, sintassi supportata solo da
> MariaDB. Con MySQL 8 la migrazione fallisce.

---

## 0. Cosa è già pronto in questo repo

Per il deploy sono stati aggiunti/aggiornati questi file:

- **`Dockerfile`** — immagine PHP 8.3 + Apache con le estensioni `pdo_mysql`,
  `gd`, `mbstring`, `zip`, `mod_rewrite` e `composer install` automatico.
- **`.dockerignore`** — esclude dump, PDF di prova e file runtime dall'immagine.
- **`.gitignore`** — evita di versionare dump, foto e report generati.
- **`config.php`** — ora legge i valori sensibili dalle **variabili d'ambiente**
  (con fallback locale XAMPP). In produzione NON contiene credenziali reali.
- **`.htaccess`** — blocca l'accesso web a `config.php`, `src/`, `vendor/`,
  `storage/`, `docs/` e ai dump.

La web root del container è la **radice del progetto**, così sono raggiungibili
sia `/public` (gestionale admin/cliente) sia `/frontend` (app tecnico),
esattamente come in locale.

---

## 1. Prerequisiti

1. **Server Hetzner Cloud** — consigliato almeno **CX22** (2 vCPU / 4 GB RAM),
   Ubuntu 22.04 o 24.04.
2. **Coolify installato** sul server. Se non lo hai ancora:
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```
   Poi apri `http://IP_DEL_SERVER:8000` e crea l'account admin.
3. Un **dominio** (o sottodominio) con un record **A** che punta all'IP del
   server — serve per HTTPS automatico.

---

## 2. Porta il codice su Git

Coolify fa il deploy da un repository (GitHub/GitLab).

```bash
cd "percorso/del/progetto/insetto"
git init
git add .
git commit -m "Deploy: Dockerfile + config env per Coolify"
git branch -M main
git remote add origin https://github.com/TUO-UTENTE/gestionale-disinfestazione.git
git push -u origin main
```

> Il `.gitignore` già esclude il dump `127_0_0_1*.sql`, `111.pdf`, `composer.phar`
> e i file runtime in `storage/`. Va bene se il repo è **privato**.

In Coolify: **Sources → aggiungi GitHub App** (o usa un repo pubblico / deploy
key) per dare a Coolify l'accesso al repository.

---

## 3. Crea il database MariaDB in Coolify

1. Apri il tuo **Project → Production → + New → Database → MariaDB**.
2. Avvia il database e annota dalla scheda **Configuration**:
   - **nome interno del servizio** (es. `mariadb-xxxx`) → sarà `DB_HOST`
   - utente, password, nome database
3. Crea un database vuoto chiamato `gestionale_disinfestazione`
   (o usa quello creato di default e adatta `DB_NAME`).

> Il database e l'app devono stare nello **stesso Project/ambiente** così
> comunicano sulla rete interna Docker tramite il nome del servizio.

---

## 4. Crea l'applicazione

1. **+ New → Application → Public/Private Repository**, seleziona il repo.
2. **Build Pack: `Dockerfile`** (Coolify rileva il `Dockerfile` nella radice).
3. **Port exposed: `80`**.
4. Salva.

---

## 5. Variabili d'ambiente

Nella scheda **Environment Variables** dell'applicazione aggiungi:

| Variabile  | Valore                                  | Note |
|------------|------------------------------------------|------|
| `APP_ENV`  | `prod`                                   | nasconde gli errori |
| `BASE_URL` | `/public`                                | dominio dedicato, root = progetto |
| `DB_HOST`  | *nome interno del servizio MariaDB*      | es. `mariadb-xxxx` |
| `DB_PORT`  | `3306`                                   | |
| `DB_NAME`  | `gestionale_disinfestazione`             | |
| `DB_USER`  | *utente del DB Coolify*                  | |
| `DB_PASS`  | *password del DB Coolify*                | |
| `DB_CHARSET` | `utf8mb4`                              | |

Facoltative (intestazione/footer report e dati fiscali) — sovrascrivono i
default in `config.php`: `AZIENDA_NOME`, `AZIENDA_PIVA`, `AZIENDA_INDIRIZZO`,
`AZIENDA_EMAIL`, `AZIENDA_TEL`, `REPORT_REV`, `REPORT_MITTENTE`, `AZIENDA_CF`,
`AZIENDA_CAP`, `AZIENDA_COMUNE`, `AZIENDA_PROVINCIA`, `IVA_DEFAULT`.

---

## 6. Volume persistente per `storage/`

**Fondamentale**: foto caricate e PDF generati vivono in `storage/`. Senza
volume persistente vengono **persi a ogni redeploy**.

In **Storages → + Add → Volume Mount**:

- **Source/Name**: `gestionale-storage`
- **Destination Path**: `/var/www/html/storage`

---

## 7. Dominio + HTTPS

Il progetto usa il sottodominio dedicato **`sentinella.testdemo.it`** (brand:
**Sentinella**), separato dagli altri progetti su `testdemo.it`.

1. **DNS** — sul gestore di `testdemo.it` aggiungi un record:

   | Campo | Valore |
   |-------|--------|
   | Type  | `A` |
   | Name  | `sentinella` |
   | Value | *IP del server Hetzner* |
   | TTL   | default (3600) |

   È indipendente dagli altri progetti: instrada solo `sentinella.testdemo.it`.

2. Nella scheda **General/Domains** dell'app inserisci (con https):
   ```
   https://sentinella.testdemo.it
   ```
3. Coolify richiede in automatico il certificato **Let's Encrypt** (assicurati
   prima che il record DNS A sia propagato e punti al server). Il reverse proxy
   interno (Traefik) instrada ogni app in base al dominio, quindi più progetti
   con sottodomini diversi convivono sullo stesso server senza conflitti.

---

## 8. Primo deploy

Premi **Deploy**. Coolify costruisce l'immagine dal `Dockerfile` e avvia il
container. Segui i log fino a "running".

---

## 9. Inizializza il database

Il container parte ma il DB è vuoto. Due opzioni:

**A) Import del dump completo (più rapido — include già dati e utenti).**
Apri il database in Coolify (terminale o aggiungi un servizio **Adminer**) e
importa `127_0_0_1 (2).sql` (presente in locale, non nel repo: caricalo a mano).

**B) Schema pulito + seed.**
Esegui in ordine, sul database, da terminale del servizio MariaDB:
```bash
mysql -u UTENTE -p gestionale_disinfestazione < schema.sql
mysql -u UTENTE -p gestionale_disinfestazione < schema_v2.sql
```
Poi crea gli utenti base eseguendo il seed **dal container dell'app**
(Coolify → Application → Terminal):
```bash
php seed.php
```
Credenziali create dal seed (da cambiare subito):
- admin → `admin@deltasoftware.it` / `admin123`
- tecnico → `tecnico@deltasoftware.it` / `tecnico123`

---

## 10. Verifica

- `https://tuodominio/` → reindirizza al login del gestionale.
- Login admin → dashboard `/public/`.
- Login tecnico → app in campo `/frontend/`.
- Crea un cliente e verifica che la card compaia (AJAX, senza reload).
- Genera un report PDF e controlla che venga salvato in `storage/reports/`.

---

## Note e limiti noti

- **Invio email report**: `src/report.php` usa la funzione PHP `mail()`, che in
  un container senza MTA non invia nulla (il PDF viene comunque salvato). Per
  l'invio reale servirà configurare un SMTP (es. integrando PHPMailer con un
  servizio come Brevo/Mailgun e relative variabili d'ambiente). Non blocca il
  deploy.
- **Sicurezza**: cambia subito le password di default dopo il primo accesso e
  imposta `APP_ENV=prod`.
- **Backup**: abilita i backup automatici del database dalla scheda del servizio
  MariaDB in Coolify.
- **Auto-deploy**: con la GitHub App collegata, ogni `git push` su `main`
  ridistribuisce automaticamente l'app.
