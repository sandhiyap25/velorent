<?php
declare(strict_types=1);

/**
 * POST /api/bookings/reminder.php
 * Allows the vehicle owner or admin to send an overdue return reminder to the renter.
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../utils/helpers.php';

handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed. Use POST.', 405);
}

$pdo = getDbConnection();
$currentUser = requireAuth($pdo);
$input = getJsonInput();

$bookingId = trim((string)($input['bookingId'] ?? ''));
$note = trim((string)($input['note'] ?? ''));

if ($bookingId === '') {
    sendError('Booking ID is required.');
}

$stmt = $pdo->prepare('SELECT * FROM bookings WHERE id = :id LIMIT 1');
$stmt->execute([':id' => $bookingId]);
$booking = $stmt->fetch();

if (!$booking) {
    sendError('Booking not found.', 404);
}

$isOwner = ((string)$booking['owner_id'] === (string)$currentUser['id']);
$isAdmin = (($currentUser['role'] ?? 'USER') === 'ADMIN');

if (!$isOwner && !$isAdmin) {
    sendError('Only the vehicle owner or an administrator can send return reminders.', 403);
}

$upd = $pdo->prepare('
    UPDATE bookings
    SET reminders_sent = reminders_sent + 1,
        last_reminder_at = UTC_TIMESTAMP()
    WHERE id = :id
');
$upd->execute([':id' => $bookingId]);

$message = $note !== ''
    ? $note
    : "Your rental {$bookingId} is overdue. Please return the vehicle immediately or contact the owner.";

createNotification(
    $pdo,
    (string)$booking['renter_id'],
    'Urgent Return Reminder from Owner',
    $message,
    'WARNING',
    "/bookings/{$bookingId}"
);

$hydrated = fetchHydratedBookings($pdo, $bookingId);
sendJson([
    'success' => true,
    'booking' => $hydrated[0] ?? null,
]);
