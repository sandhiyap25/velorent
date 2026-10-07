<?php
declare(strict_types=1);

/**
 * GET / PUT / POST /api/auth/me.php
 * - GET: Returns the currently authenticated user profile
 * - PUT / POST: Updates the authenticated user's name, phone, and city
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../utils/helpers.php';

handleCors();

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $user = getAuthenticatedUser($pdo);
    if (!$user) {
        sendJson([
            'success' => true,
            'user'    => null,
        ]);
    }
    sendJson([
        'success' => true,
        'user'    => formatUserRow($user),
    ]);
}

if ($method === 'PUT' || $method === 'POST') {
    $user = requireAuth($pdo);
    $input = getJsonInput();

    $name = trim((string)($input['name'] ?? $user['name']));
    $phone = trim((string)($input['phone'] ?? $user['phone']));
    $city = trim((string)($input['city'] ?? ($user['city'] ?: 'Bengaluru')));

    if ($name === '') {
        sendError('Name cannot be empty.');
    }
    if ($phone === '') {
        sendError('Phone number cannot be empty.');
    }

    $initials = computeInitials($name);

    $upd = $pdo->prepare('
        UPDATE users
        SET name = :name, phone = :phone, city = :city, avatar_initials = :initials
        WHERE id = :id
    ');
    $upd->execute([
        ':name'     => $name,
        ':phone'    => $phone,
        ':city'     => $city ?: 'Bengaluru',
        ':initials' => $initials,
        ':id'       => $user['id'],
    ]);

    $freshStmt = $pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
    $freshStmt->execute([':id' => $user['id']]);
    $updatedRow = $freshStmt->fetch();

    sendJson([
        'success' => true,
        'user'    => formatUserRow($updatedRow),
    ]);
}

sendError('Method not allowed.', 405);
