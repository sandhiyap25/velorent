<?php
declare(strict_types=1);

/**
 * GET /api/state/bootstrap.php
 * Returns the synchronized application state from MySQL:
 * - currentUser (if authenticated via session or Bearer token)
 * - vehicles (public marketplace + owner details)
 * - bookings (for availability conflict checks and user/owner/admin views)
 * - incidents (for operational holds and user/owner/admin views)
 * - notifications (for current authenticated user)
 * - users (public directory info for contact modals / admin metrics)
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../utils/helpers.php';

handleCors();

$pdo = getDbConnection();
$authUser = getAuthenticatedUser($pdo);

$usersStmt = $pdo->query('SELECT * FROM users ORDER BY created_at DESC');
$users = array_map('formatUserRow', $usersStmt->fetchAll());

$vehicles = fetchHydratedVehicles($pdo);
$bookings = fetchHydratedBookings($pdo);
$incidents = fetchHydratedIncidents($pdo);
$notifications = fetchHydratedNotifications($pdo, $authUser);

sendJson([
    'success'       => true,
    'currentUser'   => $authUser ? formatUserRow($authUser) : null,
    'users'         => $users,
    'vehicles'      => $vehicles,
    'bookings'      => $bookings,
    'incidents'     => $incidents,
    'notifications' => $notifications,
]);
