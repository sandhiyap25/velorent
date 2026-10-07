<?php
declare(strict_types=1);

/**
 * GET / POST /api/bookings/index.php
 * - GET: Returns bookings from MySQL
 * - POST: Creates a new vehicle reservation with full server-side validation:
 *   1. User must be authenticated
 *   2. User cannot book their own vehicle
 *   3. Vehicle must be AVAILABLE and not blocked by an open critical incident or overdue booking
 *   4. Pickup & return timestamps must be valid, minimum 1 hour, and inside the vehicle's availability window
 *   5. No overlapping active/upcoming/overdue booking on the same vehicle (`pickup < existing_return AND return > existing_pickup`)
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../utils/helpers.php';

handleCors();

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $bookingId = isset($_GET['id']) ? trim((string)$_GET['id']) : null;
    $bookings = fetchHydratedBookings($pdo, $bookingId ?: null);
    sendJson([
        'success'  => true,
        'bookings' => $bookings,
    ]);
}

if ($method === 'POST') {
    $currentUser = requireAuth($pdo);
    $input = getJsonInput();

    $vehicleId = trim((string)($input['vehicleId'] ?? ''));
    $pickupISO = trim((string)($input['pickupISO'] ?? ''));
    $returnISO = trim((string)($input['returnISO'] ?? ''));

    if ($vehicleId === '' || $pickupISO === '' || $returnISO === '') {
        sendError('Vehicle ID, pickup date/time, and return date/time are required.');
    }

    $vStmt = $pdo->prepare('SELECT * FROM vehicles WHERE id = :id LIMIT 1');
    $vStmt->execute([':id' => $vehicleId]);
    $vehicle = $vStmt->fetch();

    if (!$vehicle) {
        sendError('Selected vehicle was not found.', 404);
    }

    if ((string)$vehicle['owner_id'] === (string)$currentUser['id']) {
        sendError('You cannot book your own listed vehicle.');
    }

    if ((string)$vehicle['status'] === 'DISABLED') {
        sendError('This vehicle listing has been temporarily paused by the owner.');
    }

    // Check open blocking incidents on this vehicle
    $incStmt = $pdo->prepare("
        SELECT type FROM incidents
        WHERE vehicle_id = :vid
          AND status IN ('OPEN', 'UNDER_REVIEW')
          AND type IN ('Vehicle Not Returned', 'Suspected Theft', 'Accident')
        LIMIT 1
    ");
    $incStmt->execute([':vid' => $vehicleId]);
    $blockingIncident = $incStmt->fetch();
    if ($blockingIncident) {
        sendError("Blocked due to open incident ({$blockingIncident['type']}).");
    }

    $pickupMysql = toMysqlDateTime($pickupISO);
    $returnMysql = toMysqlDateTime($returnISO);

    if (!$pickupMysql || !$returnMysql) {
        sendError('Invalid pickup or return date/time format.');
    }

    $nowTs = time();
    $pickupTs = strtotime($pickupMysql . ' UTC');
    $returnTs = strtotime($returnMysql . ' UTC');

    if ($pickupTs < ($nowTs - 300)) {
        sendError('Pickup date and time cannot be in the past.');
    }

    if ($returnTs <= $pickupTs) {
        sendError('Return date and time must be after pickup date and time.');
    }

    $rawHours = ($returnTs - $pickupTs) / 3600.0;
    if ($rawHours < 1.0) {
        sendError('Minimum rental duration is 1 hour.');
    }

    $availFromTs = strtotime((string)$vehicle['available_from'] . ' UTC');
    $availUntilTs = strtotime((string)$vehicle['available_until'] . ' UTC');

    if ($pickupTs < $availFromTs || $returnTs > $availUntilTs) {
        sendError('Requested period must fall within the vehicle availability window.');
    }

    // Check existing bookings on this vehicle for overdue hold or overlapping time slot
    $bkStmt = $pdo->prepare('SELECT * FROM bookings WHERE vehicle_id = :vid');
    $bkStmt->execute([':vid' => $vehicleId]);
    foreach ($bkStmt->fetchAll() as $existing) {
        $st = calculateDynamicBookingStatus($existing);
        if ($st === 'OVERDUE') {
            sendError('Current rental on this vehicle has passed its return deadline and has not been checked in yet.');
        }

        if (in_array($st, ['CANCELLED', 'RETURNED', 'RETURNED_LATE'], true)) {
            continue;
        }

        $exPickupTs = strtotime((string)$existing['pickup_datetime'] . ' UTC');
        $exReturnTs = strtotime((string)$existing['return_datetime'] . ' UTC');

        if ($pickupTs < $exReturnTs && $returnTs > $exPickupTs) {
            sendError('This vehicle is already booked during the selected time.', 409);
        }
    }

    $durationHours = round($rawHours, 2);
    $hourlyRate = (float)$vehicle['hourly_rate'];
    $rentalAmount = round($durationHours * $hourlyRate);
    $securityDeposit = (float)$vehicle['security_deposit'];

    $bookingId = 'BK-' . random_int(100000, 999999);
    $initialStatus = ($pickupTs <= ($nowTs + 60)) ? 'ACTIVE' : 'UPCOMING';

    $insStmt = $pdo->prepare("
        INSERT INTO bookings (
            id, vehicle_id, renter_id, owner_id,
            pickup_datetime, return_datetime, actual_return_datetime,
            duration_hours, hourly_rate, rental_amount, security_deposit,
            late_hours, late_penalty, estimated_repair_cost, damage_amount,
            damage_review_status, status, reminders_sent, created_at
        ) VALUES (
            :id, :vehicle_id, :renter_id, :owner_id,
            :pickup, :return_dt, NULL,
            :duration_hours, :hourly_rate, :rental_amount, :security_deposit,
            0.00, 0.00, 0.00, 0.00,
            'NONE', :status, 0, UTC_TIMESTAMP()
        )
    ");
    $insStmt->execute([
        ':id'               => $bookingId,
        ':vehicle_id'       => $vehicleId,
        ':renter_id'        => $currentUser['id'],
        ':owner_id'         => $vehicle['owner_id'],
        ':pickup'           => $pickupMysql,
        ':return_dt'        => $returnMysql,
        ':duration_hours'   => $durationHours,
        ':hourly_rate'      => $hourlyRate,
        ':rental_amount'    => $rentalAmount,
        ':security_deposit' => $securityDeposit,
        ':status'           => $initialStatus,
    ]);

    createNotification(
        $pdo,
        (string)$currentUser['id'],
        'Booking confirmed successfully.',
        "Reservation {$bookingId} for {$vehicle['brand']} {$vehicle['model']} is confirmed.",
        'SUCCESS',
        "/bookings/{$bookingId}"
    );

    createNotification(
        $pdo,
        (string)$vehicle['owner_id'],
        'New Booking on Your Vehicle',
        "{$currentUser['name']} booked your {$vehicle['brand']} {$vehicle['model']} ({$bookingId}).",
        'INFO',
        "/bookings/{$bookingId}"
    );

    $hydrated = fetchHydratedBookings($pdo, $bookingId);
    sendJson([
        'success' => true,
        'booking' => $hydrated[0] ?? null,
    ], 201);
}

sendError('Method not allowed.', 405);
