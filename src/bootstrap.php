<?php
/**
 * src/bootstrap.php — punto d'ingresso comune.
 * Carica config, DB, helper e auth, imposta il reporting errori
 * in base all'ambiente e avvia la sessione.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/rbac.php';

// Autoload Composer (mPDF) se presente.
$__autoload = __DIR__ . '/../vendor/autoload.php';
if (is_file($__autoload)) {
    require_once $__autoload;
}

if (defined('APP_ENV') && APP_ENV === 'dev') {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(0);
    ini_set('display_errors', '0');
}

auth_start_session();
