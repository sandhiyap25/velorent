<?php
declare(strict_types=1);

/**
 * GET / POST /api/vehicles/index.php
 * - GET: Lists all vehicles with joined owner info, images, features, and rules
 * - POST: Authenticated user lists a new vehicle on the marketplace
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../utils/helpers.php';

handleCors();

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $vehicleId = isset($_GET['id']) ? trim((string)$_GET['id']) : null;
    $vehicles = fetchHydratedVehicles($pdo, $vehicleId ?: null);
    sendJson([
        'success'  => true,
        'vehicles' => $vehicles,
    ]);
}

if ($method === 'POST') {
    $currentUser = requireAuth($pdo);
    $input = getJsonInput();

    $allowedTypes = ['Car', 'SUV', 'Bike', 'Van'];
    $type = (string)($input['type'] ?? 'Car');
    if (!in_array($type, $allowedTypes, true)) {
        $type = 'Car';
    }

    $brand = trim((string)($input['brand'] ?? ''));
    $model = trim((string)($input['model'] ?? ''));
    $registrationNumber = strtoupper(trim((string)($input['registrationNumber'] ?? '')));
    $location = trim((string)($input['location'] ?? ''));
    $hourlyRate = (float)($input['hourlyRate'] ?? 0);
    $dailyRate = isset($input['dailyRate']) && (float)$input['dailyRate'] > 0
        ? (float)$input['dailyRate']
        : round($hourlyRate * 20, 2);
    $securityDeposit = (float)($input['securityDeposit'] ?? 0);
    $description = trim((string)($input['description'] ?? ''));
    $transmission = in_array(($input['transmission'] ?? ''), ['Automatic', 'Manual'], true)
        ? (string)$input['transmission']
        : 'Automatic';
    $fuelType = in_array(($input['fuelType'] ?? ''), ['Petrol', 'Diesel', 'Electric', 'Hybrid'], true)
        ? (string)$input['fuelType']
        : 'Petrol';
    $seats = max(1, min(15, (int)($input['seats'] ?? ($type === 'Bike' ? 2 : 5))));

    $availableFromMysql = toMysqlDateTime((string)($input['availableFrom'] ?? ''))
        ?? gmdate('Y-m-d H:i:s');
    $availableUntilMysql = toMysqlDateTime((string)($input['availableUntil'] ?? ''))
        ?? gmdate('Y-m-d H:i:s', time() + 86400 * 60);

    if ($brand === '' || $model === '') {
        sendError('Vehicle brand and model are required.');
    }
    if (strlen($registrationNumber) < 6) {
        sendError('Please enter a valid vehicle registration number.');
    }
    if ($location === '') {
        sendError('Pickup location is required.');
    }
    if ($hourlyRate <= 0) {
        sendError('Hourly rate must be greater than 0.');
    }
    if ($securityDeposit < 0) {
        sendError('Security deposit cannot be negative.');
    }
    if ($description === '') {
        sendError('Vehicle description is required.');
    }

    // Check duplicate registration number
    $dupStmt = $pdo->prepare('SELECT id FROM vehicles WHERE UPPER(registration_number) = :reg LIMIT 1');
    $dupStmt->execute([':reg' => $registrationNumber]);
    if ($dupStmt->fetch()) {
        sendError("A vehicle with registration number {$registrationNumber} is already listed on the platform.", 409);
    }

    $vehicleId = 'veh-' . substr(bin2hex(random_bytes(6)), 0, 10);
    $cancellationPolicy = trim((string)($input['cancellationPolicy'] ?? ''))
        ?: '100% full refund if cancelled before scheduled pickup time.';

    $features = is_array($input['features'] ?? null) && count($input['features']) > 0
        ? array_values(array_filter(array_map('trim', $input['features'])))
        : ['Air Conditioning', 'FASTag Active', 'Verified Registration'];

    $rules = is_array($input['rules'] ?? null) && count($input['rules']) > 0
        ? array_values(array_filter(array_map('trim', $input['rules'])))
        : [
            'Valid Indian Driving Licence mandatory at pickup.',
            'Return with same fuel level as handover.',
            'Late returns beyond scheduled time incur ₹300/hr penalty.',
        ];

    $images = is_array($input['images'] ?? null) && count($input['images']) > 0
        ? array_values(array_filter(array_map('trim', $input['images'])))
        : ['/assets/' . strtolower($type)];

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO vehicles (
                id, owner_id, type, brand, model, registration_number, location,
                hourly_rate, daily_rate, available_from, available_until, status,
                security_deposit, description, cancellation_policy, transmission,
                fuel_type, seats, created_at
            ) VALUES (
                :id, :owner_id, :type, :brand, :model, :registration_number, :location,
                :hourly_rate, :daily_rate, :available_from, :available_until, 'AVAILABLE',
                :security_deposit, :description, :cancellation_policy, :transmission,
                :fuel_type, :seats, UTC_TIMESTAMP()
            )
        ");
        $stmt->execute([
            ':id'                  => $vehicleId,
            ':owner_id'            => $currentUser['id'],
            ':type'                => $type,
            ':brand'               => $brand,
            ':model'               => $model,
            ':registration_number' => $registrationNumber,
            ':location'            => $location,
            ':hourly_rate'         => $hourlyRate,
            ':daily_rate'          => $dailyRate,
            ':available_from'      => $availableFromMysql,
            ':available_until'     => $availableUntilMysql,
            ':security_deposit'    => $securityDeposit,
            ':description'         => $description,
            ':cancellation_policy' => $cancellationPolicy,
            ':transmission'        => $transmission,
            ':fuel_type'           => $fuelType,
            ':seats'               => $seats,
        ]);

        $imgIns = $pdo->prepare('INSERT INTO vehicle_images (vehicle_id, image_url, sort_order) VALUES (:vid, :url, :ord)');
        foreach ($images as $idx => $imgUrl) {
            $imgIns->execute([':vid' => $vehicleId, ':url' => $imgUrl, ':ord' => (int)$idx]);
        }

        $featIns = $pdo->prepare('INSERT INTO vehicle_features (vehicle_id, feature_name, sort_order) VALUES (:vid, :feat, :ord)');
        foreach ($features as $idx => $featName) {
            $featIns->execute([':vid' => $vehicleId, ':feat' => $featName, ':ord' => (int)$idx]);
        }

        $ruleIns = $pdo->prepare('INSERT INTO vehicle_rules (vehicle_id, rule_text, sort_order) VALUES (:vid, :rule, :ord)');
        foreach ($rules as $idx => $ruleText) {
            $ruleIns->execute([':vid' => $vehicleId, ':rule' => $ruleText, ':ord' => (int)$idx]);
        }

        createNotification(
            $pdo,
            (string)$currentUser['id'],
            'Vehicle Listed Successfully',
            "{$brand} {$model} ({$registrationNumber}) is now live in the marketplace.",
            'SUCCESS',
            "/my-vehicles/{$vehicleId}"
        );

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        sendError('Failed to create vehicle listing: ' . $e->getMessage(), 500);
    }

    $hydrated = fetchHydratedVehicles($pdo, $vehicleId);
    sendJson([
        'success' => true,
        'vehicle' => $hydrated[0] ?? null,
    ], 201);
}

sendError('Method not allowed.', 405);
