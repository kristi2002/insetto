<?php
/** Radice del progetto: instrada verso l'app nella cartella /public. */
require_once __DIR__ . '/config.php';
header('Location: ' . BASE_URL . '/login.php');
exit;
