<?php
/**
 * src/rbac.php — Role-Based Access Control centralizzato.
 *
 * Quattro ruoli: admin, supervisore, tecnico, cliente.
 * Le capability sono stringhe "area.azione". Gli endpoint chiamano
 * require_can('area.azione'); i dati restano comunque filtrati per
 * proprietà (es. il cliente vede solo i propri).
 *
 * Gerarchia:
 *  - admin       : tutto ('*')
 *  - supervisore : gestione operativa completa MA non gli utenti
 *  - tecnico     : lavoro in campo (interventi assegnati, consumi, scansione)
 *  - cliente     : sola lettura dei propri dati
 */

/** Matrice ruolo -> capability. '*' = tutte. */
function rbac_matrix(): array
{
    return [
        'admin' => ['*'],
        'supervisore' => [
            'clienti.manage', 'locali.manage', 'postazioni.manage',
            'interventi.manage', 'interventi.field',
            'magazzino.manage', 'magazzino.use',
            'haccp.view', 'documenti.manage', 'dashboard.view',
            'config.manage',
        ],
        'tecnico' => [
            'interventi.field', 'magazzino.use', 'postazioni.read',
        ],
        'cliente' => [
            'self.read',
        ],
    ];
}

/** Vero se il ruolo possiede la capability. */
function role_can(string $role, string $cap): bool
{
    $caps = rbac_matrix()[$role] ?? [];
    return in_array('*', $caps, true) || in_array($cap, $caps, true);
}

/** Capability dell'utente corrente. */
function user_can(string $cap): bool
{
    $u = current_user();
    return $u ? role_can($u['ruolo'], $cap) : false;
}

/**
 * Richiede una capability; risponde 401/403 se non autorizzato.
 * @return array utente corrente
 */
function require_can(string $cap): array
{
    $u = require_login();
    if (!role_can($u['ruolo'], $cap)) {
        json_fail('Permesso negato per: ' . $cap, 403);
    }
    return $u;
}
