<?php
/**
 * src/helpers.php — utility comuni: risposte JSON, input, sanitizzazione.
 */

/** Invia una risposta JSON e termina lo script. */
function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Risposta di successo: { ok: true, ...payload }. */
function json_ok(array $payload = []): void
{
    json_out(['ok' => true] + $payload);
}

/** Risposta di errore: { ok: false, error: msg }. */
function json_fail(string $message, int $code = 400, array $extra = []): void
{
    json_out(['ok' => false, 'error' => $message] + $extra, $code);
}

/** Legge il body JSON di una richiesta AJAX e lo restituisce come array. */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Estrae una chiave da un array sorgente con default e trim sulle stringhe. */
function field(array $src, string $key, $default = null)
{
    if (!array_key_exists($key, $src)) {
        return $default;
    }
    $v = $src[$key];
    return is_string($v) ? trim($v) : $v;
}

/** Intero o null (per FK opzionali e campi numerici). */
function int_or_null($v): ?int
{
    if ($v === null || $v === '' ) {
        return null;
    }
    return (int) $v;
}

/** Float o null (per importi/decimali opzionali). */
function num_or_null($v): ?float
{
    if ($v === null || $v === '') {
        return null;
    }
    return (float) $v;
}

/** Escape HTML per output sicuro lato server. */
function e(?string $v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
}

/** Solo metodo HTTP atteso, altrimenti 405. */
function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== strtoupper($method)) {
        json_fail('Metodo non consentito', 405);
    }
}
