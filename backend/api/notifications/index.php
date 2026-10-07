<?php
declare(strict_types=1);

/**
 * GET / POST /api/notifications/index.php
 * - GET: Returns notifications for the authenticated user
 * - POST: Marks a single notification or all notifications as read
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../utils/helpers.php';

handleCors();

$pdo = getDbConnection();
$currentUser = requireAuth($pdo);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $notifications = fetchHydratedNotifications($pdo, $currentUser);
    sendJson([
        'success'       => true,
        'notifications' => $notifications,
    ]);
}

if ($method === 'POST' || $method === 'PUT') {
    $input = getJsonInput();
    $action = (string)($input['action'] ?? 'mark_read');

    if ($action === 'mark_all_read') {
        $stmt = $pdo->prepare("
            UPDATE notifications
            SET is_read = 1
            WHERE user_id = :uid OR target_scope = 'ALL'
        ");
        $stmt->execute([':uid' => $currentUser['id']]);
    } else {
        $notifId = trim((string)($input['id'] ?? ''));
        if ($notifId !== '') {
            $stmt = $pdo->prepare('
                UPDATE notifications
                SET is_read = 1
                WHERE id = :id
            ');
            $stmt->execute([':id' => $notifId]);
        }
    }

    $notifications = fetchHydratedNotifications($pdo, $currentUser);
    sendJson([
        'success'       => true,
        'notifications' => $notifications,
    ]);
}

sendError('Method not allowed.', 405);
