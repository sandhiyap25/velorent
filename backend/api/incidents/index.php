<?php
declare(strict_types=1);

/**
 * GET / POST /api/incidents/index.php
 * - GET: Lists incidents from MySQL
 * - POST: Authenticated user files an incident report ('Vehicle Not Returned', 'Suspected Theft',
 *   'Vehicle Damage', 'Accident', 'Other')
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../utils/helpers.php';

handleCors();

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $incidentId = isset($_GET['id']) ? trim((string)$_GET['id']) : null;
    $incidents = fetchHydratedIncidents($pdo, $incidentId ?: null);
    sendJson([
        'success'   => true,
        'incidents' => $incidents,
    ]);
}

if ($method === 'POST') {
    $currentUser = requireAuth($pdo);
    $input = getJsonInput();

    $bookingId = trim((string)($input['bookingId'] ?? ''));
    $vehicleId = trim((string)($input['vehicleId'] ?? ''));
    $type = (string)($input['type'] ?? 'Other');
    $description = trim((string)($input['description'] ?? ''));
    $estimatedDamageCost = isset($input['estimatedDamageCost']) && $input['estimatedDamageCost'] !== ''
        ? (float)$input['estimatedDamageCost']
        : null;
    $evidence = is_array($input['evidence'] ?? null) && count($input['evidence']) > 0
        ? array_values(array_filter(array_map('trim', $input['evidence'])))
        : ['incident_statement_log.pdf'];

    $allowedTypes = [
        'Vehicle Not Returned',
        'Suspected Theft',
        'Vehicle Damage',
        'Accident',
        'Other',
    ];
    if (!in_array($type, $allowedTypes, true)) {
        $type = 'Other';
    }

    if ($bookingId === '' || $vehicleId === '' || $description === '') {
        sendError('Booking ID, Vehicle ID, and incident description are required.');
    }

    $bkStmt = $pdo->prepare('SELECT * FROM bookings WHERE id = :id LIMIT 1');
    $bkStmt->execute([':id' => $bookingId]);
    $booking = $bkStmt->fetch();

    if (!$booking) {
        sendError('Associated booking was not found.', 404);
    }

    $isRenter = ((string)$booking['renter_id'] === (string)$currentUser['id']);
    $isOwner = ((string)$booking['owner_id'] === (string)$currentUser['id']);
    $isAdmin = (($currentUser['role'] ?? 'USER') === 'ADMIN');

    if (!$isRenter && !$isOwner && !$isAdmin) {
        sendError('You do not have permission to file an incident on this booking.', 403);
    }

    $priorityMap = [
        'Suspected Theft'      => 'CRITICAL',
        'Vehicle Not Returned' => 'HIGH',
        'Accident'             => 'HIGH',
        'Vehicle Damage'       => 'STANDARD',
        'Other'                => 'STANDARD',
    ];
    $priority = $priorityMap[$type] ?? 'STANDARD';

    $reporterRole = $isAdmin ? 'ADMIN' : ($isOwner ? 'OWNER' : 'RENTER');
    $adminRemarks = ($type === 'Suspected Theft')
        ? 'HIGH PRIORITY ESCALATION: Logged for immediate platform risk review. Owner advised to contact local police authorities.'
        : 'Incident logged and assigned to platform operations queue.';
    $damageStatus = ($type === 'Vehicle Damage') ? 'PENDING_REVIEW' : 'NONE';

    $incidentId = 'INC-' . random_int(1000, 9999);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO incidents (
                id, booking_id, vehicle_id, reported_by, reporter_role,
                type, priority, description, status, admin_remarks,
                estimated_damage_cost, approved_damage_amount, damage_status,
                created_at, updated_at
            ) VALUES (
                :id, :booking_id, :vehicle_id, :reported_by, :reporter_role,
                :type, :priority, :description, 'OPEN', :admin_remarks,
                :est_cost, 0.00, :damage_status,
                UTC_TIMESTAMP(), UTC_TIMESTAMP()
            )
        ");
        $stmt->execute([
            ':id'            => $incidentId,
            ':booking_id'    => $bookingId,
            ':vehicle_id'    => $vehicleId,
            ':reported_by'   => $currentUser['id'],
            ':reporter_role' => $reporterRole,
            ':type'          => $type,
            ':priority'      => $priority,
            ':description'   => $description,
            ':admin_remarks' => $adminRemarks,
            ':est_cost'      => $estimatedDamageCost,
            ':damage_status' => $damageStatus,
        ]);

        $evIns = $pdo->prepare('INSERT INTO incident_evidence (incident_id, file_url) VALUES (:iid, :url)');
        foreach ($evidence as $fileUrl) {
            $evIns->execute([':iid' => $incidentId, ':url' => $fileUrl]);
        }

        createNotification(
            $pdo,
            (string)$currentUser['id'],
            'Incident report created.',
            "Incident {$incidentId} ({$type}) has been logged for Booking {$bookingId}.",
            ($type === 'Suspected Theft') ? 'ERROR' : 'WARNING',
            "/bookings/{$bookingId}"
        );

        if ((string)$booking['renter_id'] !== (string)$currentUser['id']) {
            createNotification(
                $pdo,
                (string)$booking['renter_id'],
                "Incident Filed on Booking {$bookingId}",
                "An incident report ({$type}) was filed regarding your rental {$bookingId}.",
                'ERROR',
                "/bookings/{$bookingId}"
            );
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        sendError('Failed to create incident report: ' . $e->getMessage(), 500);
    }

    $hydrated = fetchHydratedIncidents($pdo, $incidentId);
    sendJson([
        'success'  => true,
        'incident' => $hydrated[0] ?? null,
    ], 201);
}

sendError('Method not allowed.', 405);
