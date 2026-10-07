<?php
declare(strict_types=1);

/**
 * POST /api/incidents/resolve.php
 * Admin-only endpoint to review & resolve incident claims and settle security deposit deductions.
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../utils/helpers.php';

handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
    sendError('Method not allowed. Use POST.', 405);
}

$pdo = getDbConnection();
$adminUser = requireAdmin($pdo);
$input = getJsonInput();

$incidentId = trim((string)($input['incidentId'] ?? ''));
$status = (string)($input['status'] ?? 'UNDER_REVIEW');
$adminRemarks = trim((string)($input['adminRemarks'] ?? ''));
$damageDecision = isset($input['damageDecision']) ? (string)$input['damageDecision'] : null;
$approvedDamageAmount = isset($input['approvedDamageAmount'])
    ? max(0.0, round((float)$input['approvedDamageAmount']))
    : 0.0;

if ($incidentId === '') {
    sendError('Incident ID is required.');
}

$allowedStatuses = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'];
if (!in_array($status, $allowedStatuses, true)) {
    $status = 'UNDER_REVIEW';
}

$allowedDecisions = ['NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED'];
if ($damageDecision !== null && !in_array($damageDecision, $allowedDecisions, true)) {
    $damageDecision = 'PENDING_REVIEW';
}

$incStmt = $pdo->prepare('SELECT * FROM incidents WHERE id = :id LIMIT 1');
$incStmt->execute([':id' => $incidentId]);
$incident = $incStmt->fetch();

if (!$incident) {
    sendError('Incident not found.', 404);
}

if ($damageDecision === 'REJECTED') {
    $approvedDamageAmount = 0.0;
}

$finalRemarks = $adminRemarks !== '' ? $adminRemarks : (string)$incident['admin_remarks'];
$finalDecision = $damageDecision ?: (string)($incident['damage_status'] ?: 'NONE');

$pdo->beginTransaction();
try {
    $updInc = $pdo->prepare('
        UPDATE incidents
        SET status = :status,
            admin_remarks = :remarks,
            damage_status = :damage_status,
            approved_damage_amount = :approved_amount,
            updated_at = UTC_TIMESTAMP()
        WHERE id = :id
    ');
    $updInc->execute([
        ':status'          => $status,
        ':remarks'         => $finalRemarks,
        ':damage_status'   => $finalDecision,
        ':approved_amount' => $approvedDamageAmount,
        ':id'              => $incidentId,
    ]);

    // Sync with linked booking if damage decision provided
    if (!empty($incident['booking_id']) && $damageDecision !== null) {
        $bkStmt = $pdo->prepare('SELECT * FROM bookings WHERE id = :id LIMIT 1');
        $bkStmt->execute([':id' => $incident['booking_id']]);
        $linkedBooking = $bkStmt->fetch();

        if ($linkedBooking) {
            $bookingDamageAmt = in_array($damageDecision, ['APPROVED', 'RESOLVED'], true)
                ? $approvedDamageAmount
                : 0.0;

            $updBk = $pdo->prepare('
                UPDATE bookings
                SET damage_review_status = :review_status,
                    damage_amount = :damage_amount,
                    damage_admin_notes = :admin_notes
                WHERE id = :id
            ');
            $updBk->execute([
                ':review_status' => $damageDecision,
                ':damage_amount' => $bookingDamageAmt,
                ':admin_notes'   => $finalRemarks,
                ':id'            => $linkedBooking['id'],
            ]);

            $totalDeductions = (float)$linkedBooking['late_penalty'] + $bookingDamageAmt;
            $refundableDeposit = max(0.0, (float)$linkedBooking['security_deposit'] - $totalDeductions);
            $refFormatted = number_format($refundableDeposit);
            $dmgFormatted = number_format($bookingDamageAmt);

            $notifMsg = ($damageDecision === 'REJECTED')
                ? "Admin rejected the damage claim on {$linkedBooking['id']}. Refundable deposit: ₹{$refFormatted}."
                : "Admin approved ₹{$dmgFormatted} damage adjustment on {$linkedBooking['id']}. Refundable deposit: ₹{$refFormatted}.";

            createNotification(
                $pdo,
                (string)$linkedBooking['renter_id'],
                'Security Deposit Review Updated',
                $notifMsg,
                'INFO',
                "/bookings/{$linkedBooking['id']}"
            );
        }
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    sendError('Failed to update incident resolution: ' . $e->getMessage(), 500);
}

$hydratedInc = fetchHydratedIncidents($pdo, $incidentId);
$hydratedBk = !empty($incident['booking_id'])
    ? fetchHydratedBookings($pdo, (string)$incident['booking_id'])
    : [];

sendJson([
    'success'  => true,
    'incident' => $hydratedInc[0] ?? null,
    'booking'  => $hydratedBk[0] ?? null,
]);
