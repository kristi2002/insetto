-- ============================================================
-- Gestionale Disinfestazione — schema database (MySQL)
-- Step 1 dell'ordine di sviluppo.
--
-- Terminologia: "sito" e' stato rinominato in "locale" ovunque
-- (tabella `locali`, FK `locale_id`).
--
-- Esegui con:
--   C:\XAMPP\mysql\bin\mysql.exe -u root < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS gestionale_disinfestazione
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestionale_disinfestazione;

-- Drop in ordine inverso alle dipendenze (per re-import puliti)
DROP TABLE IF EXISTS report;
DROP TABLE IF EXISTS evidenze;
DROP TABLE IF EXISTS rilevazioni_postazione;
DROP TABLE IF EXISTS interventi;
DROP TABLE IF EXISTS soglie;
DROP TABLE IF EXISTS postazioni;
DROP TABLE IF EXISTS tipi_dispositivo;
DROP TABLE IF EXISTS aree;
DROP TABLE IF EXISTS locali;
DROP TABLE IF EXISTS clienti;
DROP TABLE IF EXISTS users;

-- ------------------------------------------------------------
-- Utenti e ruoli
-- ------------------------------------------------------------
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  ruolo ENUM('admin','tecnico','cliente') NOT NULL,
  cliente_id INT NULL,                 -- valorizzato solo se ruolo='cliente'
  attivo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Clienti (anagrafica multi-locale)
-- ------------------------------------------------------------
CREATE TABLE clienti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ragione_sociale VARCHAR(190) NOT NULL,
  partita_iva VARCHAR(20),
  sede_legale VARCHAR(255),
  riferimento_aziendale VARCHAR(150),
  email VARCHAR(190),
  telefono VARCHAR(50),
  note_interne TEXT,
  stato ENUM('attivo','inattivo','archiviato') NOT NULL DEFAULT 'attivo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- FK posticipata: users.cliente_id -> clienti.id
ALTER TABLE users
  ADD CONSTRAINT fk_users_cliente
  FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- Locali (ex "siti") — un cliente puo' avere piu' locali
-- ------------------------------------------------------------
CREATE TABLE locali (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  nome VARCHAR(190) NOT NULL,          -- es. "Sito logistico"
  indirizzo VARCHAR(255),
  frequenza_servizio VARCHAR(50),      -- es. "mensile", "trimestrale"
  foto_path VARCHAR(255),
  stato ENUM('attivo','inattivo','archiviato') NOT NULL DEFAULT 'attivo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Aree del locale (interna / esterna)
-- ------------------------------------------------------------
CREATE TABLE aree (
  id INT AUTO_INCREMENT PRIMARY KEY,
  locale_id INT NOT NULL,
  nome VARCHAR(150) NOT NULL,          -- es. "Cucina", "Giardino"
  tipo ENUM('interna','esterna') NOT NULL,
  FOREIGN KEY (locale_id) REFERENCES locali(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tipi dispositivo (configurazione)
-- ------------------------------------------------------------
CREATE TABLE tipi_dispositivo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,          -- es. "Contenitore con piastra collante"
  metrica ENUM('catture','consumo') NOT NULL  -- come si misura la postazione
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Postazioni numerate con QR
-- ------------------------------------------------------------
CREATE TABLE postazioni (
  id INT AUTO_INCREMENT PRIMARY KEY,
  area_id INT NOT NULL,
  numero INT NOT NULL,                 -- es. 6
  ubicazione VARCHAR(255),             -- es. "Sala sotto frigo"
  tipo_dispositivo_id INT NOT NULL,
  qr_code VARCHAR(100) UNIQUE,         -- codice scansionabile
  grado_rischio ENUM('minimo','medio','alto') NOT NULL DEFAULT 'minimo',
  attiva TINYINT(1) NOT NULL DEFAULT 1,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  FOREIGN KEY (area_id) REFERENCES aree(id) ON DELETE CASCADE,
  FOREIGN KEY (tipo_dispositivo_id) REFERENCES tipi_dispositivo(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Soglie (configurazione limiti per tipo dispositivo)
-- ------------------------------------------------------------
CREATE TABLE soglie (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo_dispositivo_id INT NOT NULL,
  limite INT NOT NULL DEFAULT 1,       -- es. <= 1 postazione con attivita'
  FOREIGN KEY (tipo_dispositivo_id) REFERENCES tipi_dispositivo(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Interventi (monitoraggio)
-- ------------------------------------------------------------
CREATE TABLE interventi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  locale_id INT NOT NULL,
  tecnico_id INT NOT NULL,
  data DATE NOT NULL,
  tipologia ENUM('programmato','straordinario','primo_impianto','sopralluogo') NOT NULL,
  stato_strutture VARCHAR(50),         -- es. "Accettabile"
  stato_serramenti VARCHAR(50),
  segnalazioni TEXT,
  stato ENUM('bozza','validato','inviato') NOT NULL DEFAULT 'bozza',
  validato_at DATETIME NULL,
  FOREIGN KEY (locale_id) REFERENCES locali(id),
  FOREIGN KEY (tecnico_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Rilevazioni per postazione (dentro un intervento)
-- ------------------------------------------------------------
CREATE TABLE rilevazioni_postazione (
  id INT AUTO_INCREMENT PRIMARY KEY,
  intervento_id INT NOT NULL,
  postazione_id INT NOT NULL,
  catture INT NULL,                    -- per dispositivi a cattura
  consumo_esca_pct INT NULL,           -- per dispositivi a esca (0-100)
  stato_trappola VARCHAR(50) DEFAULT 'OK',
  FOREIGN KEY (intervento_id) REFERENCES interventi(id) ON DELETE CASCADE,
  FOREIGN KEY (postazione_id) REFERENCES postazioni(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Evidenze (specie, fonti) per intervento/area
-- ------------------------------------------------------------
CREATE TABLE evidenze (
  id INT AUTO_INCREMENT PRIMARY KEY,
  intervento_id INT NOT NULL,
  area_id INT NULL,
  specie_rilevate VARCHAR(190),
  evidenze VARCHAR(255),
  fonti_infestazione VARCHAR(255),
  FOREIGN KEY (intervento_id) REFERENCES interventi(id) ON DELETE CASCADE,
  FOREIGN KEY (area_id) REFERENCES aree(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Report PDF (uno per intervento)
-- ------------------------------------------------------------
CREATE TABLE report (
  id INT AUTO_INCREMENT PRIMARY KEY,
  intervento_id INT NOT NULL UNIQUE,
  pdf_path VARCHAR(255),
  inviato_at DATETIME NULL,
  FOREIGN KEY (intervento_id) REFERENCES interventi(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Indici utili
-- ------------------------------------------------------------
CREATE INDEX idx_locali_cliente   ON locali(cliente_id);
CREATE INDEX idx_aree_locale      ON aree(locale_id);
CREATE INDEX idx_postazioni_area  ON postazioni(area_id);
CREATE INDEX idx_interventi_locale ON interventi(locale_id);
CREATE INDEX idx_interventi_tecnico ON interventi(tecnico_id);
CREATE INDEX idx_rilev_intervento ON rilevazioni_postazione(intervento_id);

ALTER TABLE aree
  ADD COLUMN intervento_id INT NULL,
  ADD CONSTRAINT fk_aree_intervento FOREIGN KEY (intervento_id) REFERENCES interventi(id) ON DELETE CASCADE;
