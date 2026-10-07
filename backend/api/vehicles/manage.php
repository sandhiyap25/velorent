<?php
declare(strict_types=1);

/**
 * PUT / POST / DELETE /api/vehicles/manage.php
 * Server-side ownership & operational checks for updating, toggling status, or deleting a vehicle.
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../utils/helpers.php';

handleCors();

$pdo = getDbConnection();
$currentUser = requireAuth($pdo);
$method = $_SERVER['REQUEST_METHOD'] ?? 'POST';
$input = getJsonInput();

$vehicleId = trim((string)($input['vehicleId'] ?? $_GET['id'] ?? ''));
if ($vehicleId === '') {
    sendError('Vehicle ID is required.');
}

$vStmt = $pdo->prepare('SELECT * FROM vehicles WHERE id = :id LIMIT 1');
$vStmt->execute([':id' => $vehicleId]);
$vehicle = $vStmt->fetch();

if (!$vehicle) {
    sendError('Vehicle not found.', 404);
}

$isOwner = ((string)$vehicle['owner_id'] === (string)$currentUser['id']);
$isAdmin = (($currentUser['role'] ?? 'USER') === 'ADMIN');

if (!$isOwner && !$isAdmin) {
    sendError('You do not have permission to modify this vehicle listing.', 403);
}

$action = (string)($input['action'] ?? ($method === 'DELETE' ? 'delete' : 'update'));

// Check bookings on this vehicle
$bkStmt = $pdo->prepare('SELECT * FROM bookings WHERE vehicle_id = :vid');
$bkStmt->execute([':vid' => $vehicleId]);
$vehicleBookings = $bkStmt->fetchAll();

if ($action === 'toggle_status') {
    $currentStatus = (string)$vehicle['status'];

    foreach ($vehicleBookings as $b) {
        $st = calculateDynamicBookingStatus($b);
        if ($currentStatus === 'AVAILABLE' && ($st === 'ACTIVE' || $st === 'OVERDUE')) {
            sendError("Cannot disable listing while booking {$b['id']} is currently {$st}.");
        }
    }

    $newStatus = ($currentStatus === 'AVAILABLE') ? 'DISABLED' : 'AVAILABLE';
    $upd = $pdo->prepare('UPDATE vehicles SET status = :status WHERE id = :id');
    $upd->execute([':status' => $newStatus, ':id' => $vehicleId]);

    $hydrated = fetchHydratedVehicles($pdo, $vehicleId);
    sendJson([
        'success'   => true,
        'newStatus' => $newStatus,
        'vehicle'   => $hydrated[0] ?? null,
    ]);
}

if ($action === 'delete' || $method === 'DELETE') {
    foreach ($vehicleBookings as $b) {
        $st = calculateDynamicBookingStatus($b);
        if (in_array($st, ['ACTIVE', 'OVERDUE', 'UPCOMING'], true)) {
            sendError("Cannot delete vehicle with an " . strtolower($st) . " booking ({$b['id']}).");
        }
    }

    try {
        // Try a real delete first (works cleanly when the vehicle has no booking
        // history at all, e.g. it was just listed and never booked).
        $del = $pdo->prepare('DELETE FROM vehicles WHERE id = :id');
        $del->execute([':id' => $vehicleId]);
    } catch (Throwable $e) {
        // bookings.vehicle_id is ON DELETE RESTRICT, so a vehicle that has any
        // completed/cancelled booking history cannot be hard-deleted without
        // destroying that history. Fall back to a soft delete: the listing is
        // hidden from the marketplace and "My fleet" immediately, and the
        // booking/earnings records it is tied to stay intact.
        $isFkViolation = ($e instanceof PDOException) && ((string)$e->getCode() === '23000');
        if (!$isFkViolation) {
            sendError('Failed to delete vehicle: ' . $e->getMessage(), 500);
        }

        try {
            $soft = $pdo->prepare("UPDATE vehicles SET is_deleted = 1, status = 'DISABLED' WHERE id = :id");
            $soft->execute([':id' => $vehicleId]);
        } catch (Throwable $e2) {
            // Most likely cause: database/migration_soft_delete_vehicles.sql
            // has not been run yet, so the `is_deleted` column doesn't exist.
            sendError(
                'Failed to remove vehicle: this vehicle has booking history and could not be soft-deleted. ' .
                'Run database/migration_soft_delete_vehicles.sql against your database, then try again. ' .
                '(' . $e2->getMessage() . ')',
                500
            );
        }
    }

    sendJson([
        'success' => true,
        'message' => 'Vehicle removed from fleet.',
    ]);
}

// Default: update vehicle fields
$updates = $input['updates'] ?? $input;

$brand = isset($updates['brand']) ? trim((string)$updates['brand']) : (string)$vehicle['brand'];
$model = isset($updates['model']) ? trim((string)$updates['model']) : (string)$vehicle['model'];
$type = isset($updates['type']) && in_array($updates['type'], ['Car', 'SUV', 'Bike', 'Van'], true)
    ? (string)$updates['type']
    : (string)$vehicle['type'];
$registrationNumber = isset($updates['registrationNumber'])
    ? strtoupper(trim((string)$updates['registrationNumber']))
    : (string)$vehicle['registration_number'];
$transmission = isset($updates['transmission']) && in_array($updates['transmission'], ['Automatic', 'Manual'], true)
    ? (string)$updates['transmission']
    : (string)$vehicle['transmission'];
$fuelType = isset($updates['fuelType']) && in_array($updates['fuelType'], ['Petrol', 'Diesel', 'Electric', 'Hybrid'], true)
    ? (string)$updates['fuelType']
    : (string)$vehicle['fuel_type'];
$seats = isset($updates['seats']) ? max(1, min(15, (int)$updates['seats'])) : (int)$vehicle['seats'];
$location = isset($updates['location']) ? trim((string)$updates['location']) : (string)$vehicle['location'];
$hourlyRate = isset($updates['hourlyRate']) ? (float)$updates['hourlyRate'] : (float)$vehicle['hourly_rate'];
$dailyRate = isset($updates['dailyRate']) ? (float)$updates['dailyRate'] : (float)$vehicle['daily_rate'];
$securityDeposit = isset($updates['securityDeposit']) ? (float)$updates['securityDeposit'] : (float)$vehicle['security_deposit'];
$description = isset($updates['description']) ? trim((string)$updates['description']) : (string)$vehicle['description'];

$availableFromMysql = isset($updates['availableFrom'])
    ? (toMysqlDateTime((string)$updates['availableFrom']) ?? (string)$vehicle['available_from'])
    : (string)$vehicle['available_from'];
$availableUntilMysql = isset($updates['availableUntil'])
    ? (toMysqlDateTime((string)$updates['availableUntil']) ?? (string)$vehicle['available_until'])
    : (string)$vehicle['available_until'];

// Ensure active/overdue booking window is not shrunk
foreach ($vehicleBookings as $b) {
    $st = calculateDynamicBookingStatus($b);
    if ($st === 'ACTIVE' || $st === 'OVERDUE') {
        $nextFromTs = strtotime($availableFromMysql . ' UTC');
        $nextUntilTs = strtotime($availableUntilMysql . ' UTC');
        $bkPickupTs = strtotime((string)$b['pickup_datetime'] . ' UTC');
        $bkReturnTs = strtotime((string)$b['return_datetime'] . ' UTC');

        if ($nextFromTs > $bkPickupTs || $nextUntilTs < $bkReturnTs) {
            sendError("Cannot shrink availability window because Booking {$b['id']} is currently {$st}.");
        }
    }
}

// Check duplicate registration number if changed
if (strtoupper($registrationNumber) !== strtoupper((string)$vehicle['registration_number'])) {
    $dupStmt = $pdo->prepare('SELECT id FROM vehicles WHERE UPPER(registration_number) = :reg AND id != :id LIMIT 1');
    $dupStmt->execute([':reg' => $registrationNumber, ':id' => $vehicleId]);
    if ($dupStmt->fetch()) {
        sendError("Registration number {$registrationNumber} is already registered to another vehicle.", 409);
    }
}

$pdo->beginTransaction();
try {
    $updStmt = $pdo->prepare('
        UPDATE vehicles
        SET brand = :brand,
            model = :model,
            type = :type,
            registration_number = :reg,
            transmission = :transmission,
            fuel_type = :fuel_type,
            seats = :seats,
            location = :location,
            hourly_rate = :hourly_rate,
            daily_rate = :daily_rate,
            security_deposit = :security_deposit,
            available_from = :available_from,
            available_until = :available_until,
            description = :description
        WHERE id = :id
    ');
    $updStmt->execute([
        ':brand'            => $brand,
        ':model'            => $model,
        ':type'             => $type,
        ':reg'              => $registrationNumber,
        ':transmission'     => $transmission,
        ':fuel_type'        => $fuelType,
        ':seats'            => $seats,
        ':location'         => $location,
        ':hourly_rate'      => $hourlyRate,
        ':daily_rate'       => $dailyRate,
        ':security_deposit' => $securityDeposit,
        ':available_from'   => $availableFromMysql,
        ':available_until'  => $availableUntilMysql,
        ':description'      => $description,
        ':id'               => $vehicleId,
    ]);

    if (isset($updates['features']) && is_array($updates['features'])) {
        $pdo->prepare('DELETE FROM vehicle_features WHERE vehicle_id = :vid')->execute([':vid' => $vehicleId]);
        $featIns = $pdo->prepare('INSERT INTO vehicle_features (vehicle_id, feature_name, sort_order) VALUES (:vid, :feat, :ord)');
        foreach (array_values(array_filter(array_map('trim', $updates['features']))) as $idx => $featName) {
            $featIns->execute([':vid' => $vehicleId, ':feat' => $featName, ':ord' => (int)$idx]);
        }
    }

    if (isset($updates['images']) && is_array($updates['images']) && count($updates['images']) > 0) {
        $pdo->prepare('DELETE FROM vehicle_images WHERE vehicle_id = :vid')->execute([':vid' => $vehicleId]);
        $imgIns = $pdo->prepare('INSERT INTO vehicle_images (vehicle_id, image_url, sort_order) VALUES (:vid, :url, :ord)');
        foreach (array_values(array_filter(array_map('trim', $updates['images']))) as $idx => $imgUrl) {
            $imgIns->execute([':vid' => $vehicleId, ':url' => $imgUrl, ':ord' => (int)$idx]);
        }
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    sendError('Failed to update vehicle: ' . $e->getMessage(), 500);
}

$hydrated = fetchHydratedVehicles($pdo, $vehicleId);
sendJson([
    'success' => true,
    'vehicle' => $hydrated[0] ?? null,
]);
