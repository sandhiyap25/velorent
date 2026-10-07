<?php
declare(strict_types=1);

/**
 * POST /api/bookings/return.php
 * Processes a vehicle return check-in:
 * - Validates actual return timestamp >= pickup timestamp
 * - Calculates late return hours and late penalty (₹300/hr)
 * - Records vehicle condition on return ('No Damage', 'Minor Damage', 'Major Damage')
 * - If Minor/Major Damage is reported, sets damageReviewStatus = 'PENDING_REVIEW'
 *   (never auto-deducts damage without Admin approval) and creates a linked
 *   'Vehicle Damage' incident in the `incidents` table.
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
$actualReturnISO = trim((string)($input['actualReturnISO'] ?? ''));
$condition = (string)($input['condition'] ?? 'No Damage');
$damageDescription = trim((string)($input['damageDescription'] ?? ''));
$estimatedRepairCost = (float)($input['estimatedRepairCost'] ?? 0);
$damageEvidence = is_array($input['damageEvidence'] ?? null)
    ? array_values(array_filter(array_map('trim', $input['damageEvidence'])))
    : [];

if ($bookingId === '' || $actualReturnISO === '') {
    sendError('Booking ID and actual return date/time are required.');
}

if (!in_array($condition, ['No Damage', 'Minor Damage', 'Major Damage'], true)) {
    $condition = 'No Damage';
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
    sendError('You do not have permission to process this return.', 403);
}

$currentStatus = calculateDynamicBookingStatus($booking);
if (in_array($currentStatus, ['RETURNED', 'RETURNED_LATE', 'CANCELLED'], true)) {
    sendError('This booking has already been returned or closed.');
}

$actualMysql = toMysqlDateTime($actualReturnISO);
if (!$actualMysql) {
    sendError('Please enter a valid actual return date and time.');
}

$pickupTs = strtotime((string)$booking['pickup_datetime'] . ' UTC');
$expectedTs = strtotime((string)$booking['return_datetime'] . ' UTC');
$actualTs = strtotime($actualMysql . ' UTC');

if ($actualTs < $pickupTs) {
    sendError('Actual return date/time cannot be earlier than the pickup date/time.');
}

$hasDamage = ($condition === 'Minor Damage' || $condition === 'Major Damage');
if ($hasDamage && $damageDescription === '') {
    sendError('Please provide a damage description when reporting Minor or Major Damage.');
}

$isLate = (($actualTs - $expectedTs) > 60);
$lateHours = 0.0;
$latePenalty = 0.0;

if ($isLate) {
    $rawLateHours = ($actualTs - $expectedTs) / 3600.0;
    $lateHours = round($rawLateHours, 2);
    $latePenalty = round($lateHours * LATE_PENALTY_PER_HOUR);
}

$returnStatus = $isLate ? 'RETURNED_LATE' : 'RETURNED';
$estimatedRepair = $hasDamage ? max(0.0, round($estimatedRepairCost > 0 ? $estimatedRepairCost : 1500.0)) : 0.0;
$damageReviewStatus = $hasDamage ? 'PENDING_REVIEW' : 'NONE';
$damageAdminNotes = $hasDamage
    ? 'Damage reported upon return. Awaiting Admin verification before security deposit adjustment.'
    : null;

$pdo->beginTransaction();
try {
    $upd = $pdo->prepare('
        UPDATE bookings
        SET actual_return_datetime = :actual_dt,
            late_hours = :late_hours,
            late_penalty = :late_penalty,
            condition_on_return = :condition,
            damage_description = :damage_desc,
            estimated_repair_cost = :est_cost,
            damage_amount = 0.00,
            damage_review_status = :review_status,
            damage_admin_notes = :admin_notes,
            status = :status
        WHERE id = :id
    ');
    $upd->execute([
        ':actual_dt'     => $actualMysql,
        ':late_hours'    => $lateHours,
        ':late_penalty'  => $latePenalty,
        ':condition'     => $condition,
        ':damage_desc'   => $hasDamage ? $damageDescription : null,
        ':est_cost'      => $estimatedRepair,
        ':review_status' => $damageReviewStatus,
        ':admin_notes'   => $damageAdminNotes,
        ':status'        => $returnStatus,
        ':id'            => $bookingId,
    ]);

    if ($hasDamage && count($damageEvidence) > 0) {
        $evIns = $pdo->prepare('INSERT INTO booking_damage_evidence (booking_id, file_url) VALUES (:bid, :url)');
        foreach ($damageEvidence as $fileUrl) {
            $evIns->execute([':bid' => $bookingId, ':url' => $fileUrl]);
        }
    }

    $createdIncidentId = null;
    if ($hasDamage) {
        $createdIncidentId = 'INC-' . random_int(1000, 9999);
        $reporterRole = $isOwner ? 'OWNER' : ($isAdmin ? 'ADMIN' : 'RENTER');
        $priority = ($condition === 'Major Damage') ? 'HIGH' : 'STANDARD';
        $incDesc = "{$condition} reported on return ({$bookingId}): {$damageDescription}";

        $incIns = $pdo->prepare("
            INSERT INTO incidents (
                id, booking_id, vehicle_id, reported_by, reporter_role,
                type, priority, description, status, admin_remarks,
                estimated_damage_cost, approved_damage_amount, damage_status,
                created_at, updated_at
            ) VALUES (
                :id, :booking_id, :vehicle_id, :reported_by, :reporter_role,
                'Vehicle Damage', :priority, :description, 'UNDER_REVIEW',
                'Submitted during vehicle check-in. Pending admin assessment of repair estimate.',
                :est_cost, 0.00, 'PENDING_REVIEW',
                UTC_TIMESTAMP(), UTC_TIMESTAMP()
            )
        ");
        $incIns->execute([
            ':id'            => $createdIncidentId,
            ':booking_id'    => $bookingId,
            ':vehicle_id'    => $booking['vehicle_id'],
            ':reported_by'   => $currentUser['id'],
            ':reporter_role' => $reporterRole,
            ':priority'      => $priority,
            ':description'   => $incDesc,
            ':est_cost'      => $estimatedRepair,
        ]);

        $evidenceFiles = count($damageEvidence) > 0 ? $damageEvidence : ['return_inspection_photo.jpg'];
        $incEvIns = $pdo->prepare('INSERT INTO incident_evidence (incident_id, file_url) VALUES (:iid, :url)');
        foreach ($evidenceFiles as $fileUrl) {
            $incEvIns->execute([':iid' => $createdIncidentId, ':url' => $fileUrl]);
        }

        createNotification(
            $pdo,
            (string)$booking['renter_id'],
            'Vehicle damage report submitted.',
            "Your security deposit for booking {$bookingId} is pending admin review. No damage amount is deducted until verified.",
            'WARNING',
            "/bookings/{$bookingId}"
        );

        createNotification(
            $pdo,
            (string)$booking['owner_id'],
            'Vehicle Returned with Damage Report',
            "Booking {$bookingId} was returned with {$condition} ({$createdIncidentId}). Admin review is in progress.",
            'WARNING',
            "/bookings/{$bookingId}"
        );
    } else {
        $depFormatted = number_format((float)$booking['security_deposit']);
        $penFormatted = number_format($latePenalty);
        $msg = $isLate
            ? "Vehicle returned {$lateHours} hrs late. Late penalty of ₹{$penFormatted} applied."
            : "Vehicle returned on time in good condition. Security deposit of ₹{$depFormatted} is cleared for refund.";

        createNotification(
            $pdo,
            (string)$booking['renter_id'],
            'Vehicle Returned Successfully',
            $msg,
            'SUCCESS',
            "/bookings/{$bookingId}"
        );
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    sendError('Failed to process vehicle return: ' . $e->getMessage(), 500);
}

$hydrated = fetchHydratedBookings($pdo, $bookingId);
sendJson([
    'success' => true,
    'booking' => $hydrated[0] ?? null,
]);
