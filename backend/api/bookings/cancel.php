<?php
declare(strict_types=1);

/**
 * POST /api/bookings/cancel.php
 * Cancels an UPCOMING booking before its scheduled pickup time.
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
if ($bookingId === '') {
    sendError('Booking ID is required.');
}

$stmt = $pdo->prepare('SELECT * FROM bookings WHERE id = :id LIMIT 1');
$stmt->execute([':id' => $bookingId]);
$booking = $stmt->fetch();

if (!$booking) {
    sendError('Booking not found.', 404);
}

$isRenter = ((string)$booking['renter_id'] === (string)$currentUser['id']);
$isOwner = ((string)$booking['owner_id'] === (string)$currentUser['id']);
$isAdmin = (($currentUser['role'] ?? 'USER') === 'ADMIN');

if (!$isRenter && !$isOwner && !$isAdmin) {
    sendError('You do not have permission to cancel this booking.', 403);
}

$currentStatus = calculateDynamicBookingStatus($booking);
if ($currentStatus !== 'UPCOMING') {
    sendError('Cancellation is only permitted before the scheduled rental pickup time.');
}

$upd = $pdo->prepare("UPDATE bookings SET status = 'CANCELLED' WHERE id = :id");
$upd->execute([':id' => $bookingId]);

createNotification(
    $pdo,
    (string)$booking['renter_id'],
    'Booking Cancelled',
    "Your upcoming booking {$bookingId} has been cancelled. Full rental amount and security deposit are marked for refund.",
    'INFO',
    "/bookings/{$bookingId}"
);

$hydrated = fetchHydratedBookings($pdo, $bookingId);
sendJson([
    'success' => true,
    'booking' => $hydrated[0] ?? null,
]);
