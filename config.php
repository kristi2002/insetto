<?php
/**
 * config.php — credenziali DB e costanti dell'applicazione.
 *
 * I valori sensibili (DB, ambiente, URL, dati azienda) vengono letti dalle
 * variabili d'ambiente quando presenti (es. in produzione su Coolify/Docker),
 * con fallback ai valori di sviluppo locale (XAMPP).
 *
 * In locale puoi continuare a usare XAMPP senza impostare nulla.
 * In produzione imposta le variabili d'ambiente dal pannello Coolify.
 */

/**
 * Legge una variabile d'ambiente con valore di default.
 * Supporta sia getenv() sia $_ENV / $_SERVER (a seconda della SAPI).
 */
if (!function_exists('env')) {
    function env(string $key, $default = null)
    {
        $val = getenv($key);
        if ($val === false || $val === '') {
            if (isset($_ENV[$key]) && $_ENV[$key] !== '')      { $val = $_ENV[$key]; }
            elseif (isset($_SERVER[$key]) && $_SERVER[$key] !== '') { $val = $_SERVER[$key]; }
            else { return $default; }
        }
        // Normalizza booleani testuali.
        $low = strtolower((string) $val);
        if ($low === 'true')  { return true; }
        if ($low === 'false') { return false; }
        return $val;
    }
}

// --- Database ---
// In produzione: DB_HOST = nome del servizio MySQL Coolify (es. "mysql"),
// DB_USER / DB_PASS / DB_NAME impostati dalle variabili d'ambiente.
define('DB_HOST',    env('DB_HOST', '127.0.0.1'));
define('DB_PORT',    env('DB_PORT', '3306'));
define('DB_NAME',    env('DB_NAME', 'gestionale_disinfestazione'));
define('DB_USER',    env('DB_USER', 'root'));
define('DB_PASS',    env('DB_PASS', ''));
define('DB_CHARSET', env('DB_CHARSET', 'utf8mb4'));

// --- Applicazione ---
define('APP_NAME', env('APP_NAME', 'Gestionale Disinfestazione'));
// URL base. In locale XAMPP: "/insetto/public".
// In produzione (dominio dedicato, docroot = radice progetto) usa "/public".
define('BASE_URL', env('BASE_URL', '/public'));

// Percorsi filesystem
define('ROOT_PATH', __DIR__);
// Upload foto: fuori dalla webroot (/public) come richiesto dalla sicurezza.
define('UPLOAD_PATH', env('UPLOAD_PATH', ROOT_PATH . '/storage/uploads'));
// Report PDF generati.
define('REPORT_PATH', env('REPORT_PATH', ROOT_PATH . '/storage/reports'));

// --- Dati azienda (intestazione/footer report) ---
define('AZIENDA_NOME',      env('AZIENDA_NOME', 'Deblattizzazione Campania SRLS'));
define('AZIENDA_PIVA',      env('AZIENDA_PIVA', '09876543210'));
define('AZIENDA_INDIRIZZO', env('AZIENDA_INDIRIZZO', 'Via Esempio 10, 80100 Napoli (NA)'));
define('AZIENDA_EMAIL',     env('AZIENDA_EMAIL', 'info@deblattizzazionecampania.it'));
define('AZIENDA_TEL',       env('AZIENDA_TEL', '081 0000000'));
define('REPORT_REV',        env('REPORT_REV', 'Rev. 01 del 01/02/2022'));
define('REPORT_MITTENTE',   env('REPORT_MITTENTE', 'no-reply@deblattizzazionecampania.it'));

// --- Dati fiscali azienda (cedente/prestatore per FatturaPA/SDI) ---
define('AZIENDA_CF',            env('AZIENDA_CF', '09876543210'));
define('AZIENDA_REGIME',        env('AZIENDA_REGIME', 'RF01'));        // regime ordinario
define('AZIENDA_PAESE',         env('AZIENDA_PAESE', 'IT'));
define('AZIENDA_INDIRIZZO_VIA', env('AZIENDA_INDIRIZZO_VIA', 'Via Esempio 10'));
define('AZIENDA_CAP',           env('AZIENDA_CAP', '80100'));
define('AZIENDA_COMUNE',        env('AZIENDA_COMUNE', 'Napoli'));
define('AZIENDA_PROVINCIA',     env('AZIENDA_PROVINCIA', 'NA'));
define('IVA_DEFAULT',           (float) env('IVA_DEFAULT', 22.0));

// --- Sicurezza ---
// Ambiente: 'dev' mostra gli errori, 'prod' li nasconde.
// In produzione imposta APP_ENV=prod nelle variabili d'ambiente.
define('APP_ENV', env('APP_ENV', 'dev'));
