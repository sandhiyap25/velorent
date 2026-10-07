<?php
declare(strict_types=1);

/**
 * POST /api/auth/logout.php
 * Revokes the current Bearer token and destroys the active PHP session.
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

handleCors();

$pdo = getDbConnection();
revokeCurrentAuthToken($pdo);

sendJson([
    'success' => true,
    'message' => 'Logged out successfully.',
]);
