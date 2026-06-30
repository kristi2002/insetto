<?php
/**
 * seed.php — popola il database con utenti e configurazione di base.
 *
 * Esegui da CLI:
 *   C:\XAMPP\php\php.exe seed.php
 *
 * Idempotente: usa INSERT ... ON DUPLICATE KEY / controlli di esistenza.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/src/db.php';

$pdo = db();
echo "Seeding " . DB_NAME . " ...\n";

/* ---------- Utente admin ---------- */
$adminEmail = 'admin@deltasoftware.it';
$adminPass  = 'admin123'; // cambiare dopo il primo accesso
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$adminEmail]);
if (!$stmt->fetch()) {
    $pdo->prepare(
        'INSERT INTO users (nome, email, password_hash, ruolo) VALUES (?,?,?,?)'
    )->execute([
        'Amministratore',
        $adminEmail,
        password_hash($adminPass, PASSWORD_DEFAULT),
        'admin',
    ]);
    echo "  + admin: $adminEmail / $adminPass\n";
} else {
    echo "  = admin gia' presente\n";
}

/* ---------- Tecnico demo ---------- */
$tecEmail = 'tecnico@deltasoftware.it';
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$tecEmail]);
if (!$stmt->fetch()) {
    $pdo->prepare(
        'INSERT INTO users (nome, email, password_hash, ruolo) VALUES (?,?,?,?)'
    )->execute([
        'Mario Rossi',
        $tecEmail,
        password_hash('tecnico123', PASSWORD_DEFAULT),
        'tecnico',
    ]);
    echo "  + tecnico: $tecEmail / tecnico123\n";
} else {
    echo "  = tecnico gia' presente\n";
}

/* ---------- Tipi dispositivo + soglie ---------- */
$tipi = [
    ['Contenitore con esca rodenticida', 'consumo'],
    ['Contenitore con piastra collante', 'catture'],
    ['Trappola a cattura multipla', 'catture'],
    ['Lampada UV (insetti volanti)', 'catture'],
];
foreach ($tipi as [$nome, $metrica]) {
    $stmt = $pdo->prepare('SELECT id FROM tipi_dispositivo WHERE nome = ?');
    $stmt->execute([$nome]);
    $row = $stmt->fetch();
    if ($row) {
        $tipoId = (int) $row['id'];
    } else {
        $pdo->prepare('INSERT INTO tipi_dispositivo (nome, metrica) VALUES (?,?)')
            ->execute([$nome, $metrica]);
        $tipoId = (int) $pdo->lastInsertId();
        echo "  + tipo dispositivo: $nome ($metrica)\n";
    }
    // soglia default = 1
    $stmt = $pdo->prepare('SELECT id FROM soglie WHERE tipo_dispositivo_id = ?');
    $stmt->execute([$tipoId]);
    if (!$stmt->fetch()) {
        $pdo->prepare('INSERT INTO soglie (tipo_dispositivo_id, limite) VALUES (?, 1)')
            ->execute([$tipoId]);
    }
}

echo "Seed completato.\n";
