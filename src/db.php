<?php
/**
 * src/db.php — connessione PDO (MySQL) con prepared statements.
 *
 * Uso:
 *   require_once __DIR__ . '/db.php';
 *   $pdo = db();
 *   $stmt = $pdo->prepare('SELECT * FROM clienti WHERE id = ?');
 *   $stmt->execute([$id]);
 *   $cliente = $stmt->fetch();
 */

require_once dirname(__DIR__) . '/config.php';

/**
 * Restituisce un'istanza PDO condivisa (singleton).
 *
 * @return PDO
 */
function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        DB_HOST,
        DB_PORT,
        DB_NAME,
        DB_CHARSET
    );

    $options = [
        // Le eccezioni rendono visibili gli errori SQL (vietato SQL silenzioso).
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        // fetch() restituisce array associativi per default.
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // Prepared statement reali lato server (no emulazione).
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        // In dev mostra il dettaglio, in prod un messaggio generico.
        if (defined('APP_ENV') && APP_ENV === 'dev') {
            http_response_code(500);
            die('Errore connessione DB: ' . $e->getMessage());
        }
        http_response_code(500);
        die('Errore di connessione al database.');
    }

    return $pdo;
}
