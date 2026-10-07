<?php
declare(strict_types=1);

/**
 * VeloRent — Shared Business Logic & Database Entity Hydrators
 * Ensures PHP responses match the React TypeScript interfaces (`src/types/models.ts`) 100%.
 */

const LATE_PENALTY_PER_HOUR = 300;

function toMysqlDateTime(?string $iso): ?string
{
    if ($iso === null || trim($iso) === '') {
        return null;
    }
    try {
        $dt = new DateTime($iso);
        $dt->setTimezone(new DateTimeZone('UTC'));
        return $dt->format('Y-m-d H:i:s');
    } catch (Exception $e) {
        return null;
    }
}

function toIso8601(?string $mysqlDate): ?string
{
    if ($mysqlDate === null || trim($mysqlDate) === '') {
        return null;
    }
    try {
        $dt = new DateTime($mysqlDate, new DateTimeZone('UTC'));
        return $dt->format('Y-m-d\TH:i:s.000\Z');
    } catch (Exception $e) {
        return $mysqlDate;
    }
}

function computeInitials(string $name): string
{
    $parts = preg_split('/\s+/', trim($name)) ?: [];
    $initials = '';
    foreach ($parts as $p) {
        if ($p !== '') {
            $initials .= strtoupper(substr($p, 0, 1));
        }
    }
    return substr($initials ?: 'U', 0, 2);
}

function formatUserRow(array $row): array
{
    return [
        'id'             => (string)$row['id'],
        'name'           => (string)$row['name'],
        'email'          => (string)$row['email'],
        'phone'          => (string)$row['phone'],
        'passwordHash'   => '', // Never expose password hashes to the frontend
        'role'           => (string)$row['role'],
        'createdAt'      => toIso8601((string)$row['created_at']) ?? gmdate('Y-m-d\TH:i:s.000\Z'),
        'avatarInitials' => $row['avatar_initials'] ?: computeInitials((string)$row['name']),
        'city'           => (string)($row['city'] ?? 'Bengaluru'),
        'rating'         => (float)($row['rating'] ?? 5.0),
    ];
}

function calculateDynamicBookingStatus(array $bookingRow): string
{
    $storedStatus = (string)($bookingRow['status'] ?? 'UPCOMING');
    if ($storedStatus === 'CANCELLED') {
        return 'CANCELLED';
    }

    $nowTs = time();
    $pickupTs = strtotime((string)$bookingRow['pickup_datetime'] . ' UTC') ?: $nowTs;
    $returnTs = strtotime((string)$bookingRow['return_datetime'] . ' UTC') ?: $nowTs;

    if (!empty($bookingRow['actual_return_datetime'])) {
        $actualTs = strtotime((string)$bookingRow['actual_return_datetime'] . ' UTC') ?: $returnTs;
        if (($actualTs - $returnTs) > 60) {
            return 'RETURNED_LATE';
        }
        return 'RETURNED';
    }

    if ($nowTs < $pickupTs) {
        return 'UPCOMING';
    }
    if ($nowTs <= $returnTs) {
        return 'ACTIVE';
    }
    return 'OVERDUE';
}

function fetchHydratedVehicles(PDO $pdo, ?string $vehicleId = null): array
{
    $sql = '
        SELECT
            v.*,
            u.name   AS owner_name,
            u.phone  AS owner_phone,
            u.rating AS owner_rating
        FROM vehicles v
        INNER JOIN users u ON u.id = v.owner_id
    ';
    $params = [];
    if ($vehicleId !== null) {
        $sql .= ' WHERE v.id = :vehicle_id';
        $params[':vehicle_id'] = $vehicleId;
    } else {
        $sql .= ' WHERE v.is_deleted = 0';
    }
    $sql .= ' ORDER BY v.created_at DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    if (!$rows) {
        return [];
    }

    $ids = array_column($rows, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    // Fetch images
    $imgStmt = $pdo->prepare("SELECT vehicle_id, image_url FROM vehicle_images WHERE vehicle_id IN ($placeholders) ORDER BY sort_order ASC, id ASC");
    $imgStmt->execute($ids);
    $imagesByVehicle = [];
    foreach ($imgStmt->fetchAll() as $img) {
        $imagesByVehicle[$img['vehicle_id']][] = (string)$img['image_url'];
    }

    // Fetch features
    $featStmt = $pdo->prepare("SELECT vehicle_id, feature_name FROM vehicle_features WHERE vehicle_id IN ($placeholders) ORDER BY sort_order ASC, id ASC");
    $featStmt->execute($ids);
    $featuresByVehicle = [];
    foreach ($featStmt->fetchAll() as $feat) {
        $featuresByVehicle[$feat['vehicle_id']][] = (string)$feat['feature_name'];
    }

    // Fetch rules
    $ruleStmt = $pdo->prepare("SELECT vehicle_id, rule_text FROM vehicle_rules WHERE vehicle_id IN ($placeholders) ORDER BY sort_order ASC, id ASC");
    $ruleStmt->execute($ids);
    $rulesByVehicle = [];
    foreach ($ruleStmt->fetchAll() as $rule) {
        $rulesByVehicle[$rule['vehicle_id']][] = (string)$rule['rule_text'];
    }

    $result = [];
    foreach ($rows as $row) {
        $vid = (string)$row['id'];
        $result[] = [
            'id'                 => $vid,
            'ownerId'            => (string)$row['owner_id'],
            'ownerName'          => (string)$row['owner_name'],
            'ownerPhone'         => (string)$row['owner_phone'],
            'ownerRating'        => (float)$row['owner_rating'],
            'type'               => (string)$row['type'],
            'brand'              => (string)$row['brand'],
            'model'              => (string)$row['model'],
            'registrationNumber' => (string)$row['registration_number'],
            'location'           => (string)$row['location'],
            'hourlyRate'         => (float)$row['hourly_rate'],
            'dailyRate'          => (float)$row['daily_rate'],
            'availableFrom'      => toIso8601((string)$row['available_from']),
            'availableUntil'     => toIso8601((string)$row['available_until']),
            'status'             => (string)$row['status'],
            'securityDeposit'    => (float)$row['security_deposit'],
            'description'        => (string)$row['description'],
            'features'           => $featuresByVehicle[$vid] ?? [],
            'rules'              => $rulesByVehicle[$vid] ?? [],
            'cancellationPolicy' => (string)$row['cancellation_policy'],
            'images'             => $imagesByVehicle[$vid] ?? ['/assets/car'],
            'transmission'       => (string)$row['transmission'],
            'fuelType'           => (string)$row['fuel_type'],
            'seats'              => (int)$row['seats'],
            'createdAt'          => toIso8601((string)$row['created_at']),
        ];
    }

    return $result;
}

function fetchHydratedBookings(PDO $pdo, ?string $bookingId = null): array
{
    $sql = '
        SELECT
            b.*,
            r.name  AS renter_name,
            r.email AS renter_email,
            r.phone AS renter_phone,
            o.name  AS owner_name
        FROM bookings b
        INNER JOIN users r ON r.id = b.renter_id
        INNER JOIN users o ON o.id = b.owner_id
    ';
    $params = [];
    if ($bookingId !== null) {
        $sql .= ' WHERE b.id = :booking_id';
        $params[':booking_id'] = $bookingId;
    }
    $sql .= ' ORDER BY b.created_at DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    if (!$rows) {
        return [];
    }

    $ids = array_column($rows, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    $evStmt = $pdo->prepare("SELECT booking_id, file_url FROM booking_damage_evidence WHERE booking_id IN ($placeholders) ORDER BY id ASC");
    $evStmt->execute($ids);
    $evidenceByBooking = [];
    foreach ($evStmt->fetchAll() as $ev) {
        $evidenceByBooking[$ev['booking_id']][] = (string)$ev['file_url'];
    }

    $result = [];
    foreach ($rows as $row) {
        $bid = (string)$row['id'];
        $computedStatus = calculateDynamicBookingStatus($row);

        // Keep DB status synced when time transitions UPCOMING -> ACTIVE -> OVERDUE
        if ($computedStatus !== $row['status']) {
            $upd = $pdo->prepare('UPDATE bookings SET status = :status WHERE id = :id');
            $upd->execute([':status' => $computedStatus, ':id' => $bid]);
        }

        $result[] = [
            'id'                   => $bid,
            'vehicleId'            => (string)$row['vehicle_id'],
            'renterId'             => (string)$row['renter_id'],
            'renterName'           => (string)$row['renter_name'],
            'renterEmail'          => (string)$row['renter_email'],
            'renterPhone'          => (string)$row['renter_phone'],
            'ownerId'              => (string)$row['owner_id'],
            'ownerName'            => (string)$row['owner_name'],
            'pickupDateTime'       => toIso8601((string)$row['pickup_datetime']),
            'returnDateTime'       => toIso8601((string)$row['return_datetime']),
            'actualReturnDateTime' => $row['actual_return_datetime'] ? toIso8601((string)$row['actual_return_datetime']) : null,
            'durationHours'        => (float)$row['duration_hours'],
            'hourlyRate'           => (float)$row['hourly_rate'],
            'rentalAmount'         => (float)$row['rental_amount'],
            'securityDeposit'      => (float)$row['security_deposit'],
            'lateHours'            => (float)$row['late_hours'],
            'latePenalty'          => (float)$row['late_penalty'],
            'conditionOnReturn'    => $row['condition_on_return'] ?: null,
            'damageDescription'    => $row['damage_description'] ?: null,
            'damageEvidence'       => $evidenceByBooking[$bid] ?? [],
            'estimatedRepairCost'  => (float)$row['estimated_repair_cost'],
            'damageAmount'         => (float)$row['damage_amount'],
            'damageReviewStatus'   => (string)$row['damage_review_status'],
            'damageAdminNotes'     => $row['damage_admin_notes'] ?: null,
            'status'               => $computedStatus,
            'remindersSent'        => (int)$row['reminders_sent'],
            'lastReminderAt'       => $row['last_reminder_at'] ? toIso8601((string)$row['last_reminder_at']) : null,
            'createdAt'            => toIso8601((string)$row['created_at']),
        ];
    }

    return $result;
}

function fetchHydratedIncidents(PDO $pdo, ?string $incidentId = null): array
{
    $sql = '
        SELECT
            i.*,
            u.name AS reporter_name
        FROM incidents i
        INNER JOIN users u ON u.id = i.reported_by
    ';
    $params = [];
    if ($incidentId !== null) {
        $sql .= ' WHERE i.id = :incident_id';
        $params[':incident_id'] = $incidentId;
    }
    $sql .= ' ORDER BY i.created_at DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    if (!$rows) {
        return [];
    }

    $ids = array_column($rows, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    $evStmt = $pdo->prepare("SELECT incident_id, file_url FROM incident_evidence WHERE incident_id IN ($placeholders) ORDER BY id ASC");
    $evStmt->execute($ids);
    $evidenceByIncident = [];
    foreach ($evStmt->fetchAll() as $ev) {
        $evidenceByIncident[$ev['incident_id']][] = (string)$ev['file_url'];
    }

    $result = [];
    foreach ($rows as $row) {
        $iid = (string)$row['id'];
        $result[] = [
            'id'                   => $iid,
            'bookingId'            => (string)$row['booking_id'],
            'vehicleId'            => (string)$row['vehicle_id'],
            'reportedBy'           => (string)$row['reported_by'],
            'reporterName'         => (string)$row['reporter_name'],
            'reporterRole'         => (string)$row['reporter_role'],
            'type'                 => (string)$row['type'],
            'priority'             => (string)$row['priority'],
            'description'          => (string)$row['description'],
            'evidence'             => $evidenceByIncident[$iid] ?? [],
            'status'               => (string)$row['status'],
            'adminRemarks'         => (string)($row['admin_remarks'] ?? ''),
            'estimatedDamageCost'  => $row['estimated_damage_cost'] !== null ? (float)$row['estimated_damage_cost'] : null,
            'approvedDamageAmount' => (float)$row['approved_damage_amount'],
            'damageStatus'         => $row['damage_status'] ?: null,
            'createdAt'            => toIso8601((string)$row['created_at']),
            'updatedAt'            => toIso8601((string)$row['updated_at']),
        ];
    }

    return $result;
}

function fetchHydratedNotifications(PDO $pdo, ?array $currentUser): array
{
    if (!$currentUser) {
        return [];
    }

    if (($currentUser['role'] ?? 'USER') === 'ADMIN') {
        $stmt = $pdo->prepare("
            SELECT * FROM notifications
            WHERE user_id = :uid OR target_scope IN ('ADMIN', 'ALL')
            ORDER BY created_at DESC
            LIMIT 50
        ");
        $stmt->execute([':uid' => $currentUser['id']]);
    } else {
        $stmt = $pdo->prepare("
            SELECT * FROM notifications
            WHERE user_id = :uid OR target_scope = 'ALL'
            ORDER BY created_at DESC
            LIMIT 50
        ");
        $stmt->execute([':uid' => $currentUser['id']]);
    }

    $result = [];
    foreach ($stmt->fetchAll() as $row) {
        $userIdVal = $row['target_scope'] === 'ALL'
            ? 'ALL'
            : ($row['target_scope'] === 'ADMIN' ? 'ADMIN' : (string)$row['user_id']);

        $result[] = [
            'id'        => (string)$row['id'],
            'userId'    => $userIdVal,
            'title'     => (string)$row['title'],
            'message'   => (string)$row['message'],
            'type'      => (string)$row['type'],
            'read'      => (bool)$row['is_read'],
            'link'      => $row['link'] ? (string)$row['link'] : null,
            'createdAt' => toIso8601((string)$row['created_at']),
        ];
    }

    return $result;
}

function createNotification(
    PDO $pdo,
    ?string $userId,
    string $title,
    string $message,
    string $type = 'INFO',
    ?string $link = null,
    string $targetScope = 'USER'
): void {
    $notifId = 'notif-' . bin2hex(random_bytes(5));
    $stmt = $pdo->prepare('
        INSERT INTO notifications (id, user_id, target_scope, title, message, type, is_read, link, created_at)
        VALUES (:id, :user_id, :target_scope, :title, :message, :type, 0, :link, UTC_TIMESTAMP())
    ');
    $stmt->execute([
        ':id'           => $notifId,
        ':user_id'      => $userId,
        ':target_scope' => $targetScope,
        ':title'        => $title,
        ':message'      => $message,
        ':type'         => $type,
        ':link'         => $link,
    ]);
}
