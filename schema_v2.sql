-- ============================================================
-- schema_v2.sql — estensione: Inventario, HACCP/IPM, Fatturazione SDI, Ruolo supervisore
-- Migrazione ADDITIVA (mantiene i dati esistenti). MariaDB (XAMPP).
--   C:\XAMPP\mysql\bin\mysql.exe -u root < schema_v2.sql
-- ============================================================
USE gestionale_disinfestazione;

-- ---------- Ruoli: aggiunge 'supervisore' ----------
ALTER TABLE users
  MODIFY ruolo ENUM('admin','supervisore','tecnico','cliente') NOT NULL;

-- ---------- Clienti: campi fiscali per SDI ----------
ALTER TABLE clienti
  ADD COLUMN IF NOT EXISTS codice_fiscale VARCHAR(16) NULL,
  ADD COLUMN IF NOT EXISTS codice_sdi VARCHAR(7) NULL,     -- codice destinatario SDI
  ADD COLUMN IF NOT EXISTS pec VARCHAR(190) NULL;


-- ============================================================
-- INVENTARIO / MAGAZZINO
-- ============================================================
CREATE TABLE IF NOT EXISTS articoli (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(190) NOT NULL,
  tipo ENUM('esca','trappola','prodotto','presidio') NOT NULL DEFAULT 'prodotto',
  codice VARCHAR(80),                       -- codice interno / presidio medico-chirurgico
  unita VARCHAR(20) NOT NULL DEFAULT 'pz',  -- pz, kg, l
  prezzo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  soglia_riordino DECIMAL(10,2) NOT NULL DEFAULT 0,  -- reorder point
  attivo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lotti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  articolo_id INT NOT NULL,
  codice_lotto VARCHAR(80) NOT NULL,
  scadenza DATE NULL,
  quantita_iniziale DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantita_residua DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (articolo_id) REFERENCES articoli(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Consumo prodotti per intervento (= movimento di scarico)
CREATE TABLE IF NOT EXISTS consumi_intervento (
  id INT AUTO_INCREMENT PRIMARY KEY,
  intervento_id INT NOT NULL,
  articolo_id INT NOT NULL,
  lotto_id INT NULL,
  quantita DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (intervento_id) REFERENCES interventi(id) ON DELETE CASCADE,
  FOREIGN KEY (articolo_id) REFERENCES articoli(id),
  FOREIGN KEY (lotto_id) REFERENCES lotti(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- HACCP / IPM — log superamento soglie
-- ============================================================
CREATE TABLE IF NOT EXISTS haccp_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  intervento_id INT NOT NULL,
  area_id INT NULL,
  tipo_dispositivo_id INT NULL,
  data DATE NOT NULL,
  totale_postazioni INT NOT NULL DEFAULT 0,
  con_attivita INT NOT NULL DEFAULT 0,
  limite INT NOT NULL DEFAULT 0,
  esito ENUM('superato','non_superato') NOT NULL,
  note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (intervento_id) REFERENCES interventi(id) ON DELETE CASCADE,
  FOREIGN KEY (area_id) REFERENCES aree(id) ON DELETE SET NULL,
  FOREIGN KEY (tipo_dispositivo_id) REFERENCES tipi_dispositivo(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- FATTURAZIONE / SDI (preventivi + fatture)
-- ============================================================
CREATE TABLE IF NOT EXISTS documenti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('preventivo','fattura') NOT NULL,
  numero VARCHAR(40),
  anno INT,
  data DATE NOT NULL,
  cliente_id INT NOT NULL,
  intervento_id INT NULL,
  imponibile DECIMAL(12,2) NOT NULL DEFAULT 0,
  iva DECIMAL(12,2) NOT NULL DEFAULT 0,
  totale DECIMAL(12,2) NOT NULL DEFAULT 0,
  aliquota_iva DECIMAL(5,2) NOT NULL DEFAULT 22,
  stato ENUM('bozza','emesso','inviato_sdi','pagato','annullato') NOT NULL DEFAULT 'bozza',
  xml_path VARCHAR(255) NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clienti(id),
  FOREIGN KEY (intervento_id) REFERENCES interventi(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS documento_righe (
  id INT AUTO_INCREMENT PRIMARY KEY,
  documento_id INT NOT NULL,
  descrizione VARCHAR(255) NOT NULL,
  quantita DECIMAL(10,2) NOT NULL DEFAULT 1,
  prezzo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  aliquota_iva DECIMAL(5,2) NOT NULL DEFAULT 22,
  importo DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (documento_id) REFERENCES documenti(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Indici utili
CREATE INDEX idx_lotti_articolo      ON lotti(articolo_id);
CREATE INDEX idx_consumi_intervento  ON consumi_intervento(intervento_id);
CREATE INDEX idx_consumi_articolo    ON consumi_intervento(articolo_id);
CREATE INDEX idx_haccp_intervento    ON haccp_log(intervento_id);
CREATE INDEX idx_haccp_data          ON haccp_log(data);
CREATE INDEX idx_documenti_cliente   ON documenti(cliente_id);
CREATE INDEX idx_documenti_tipo      ON documenti(tipo);
