<?php
declare(strict_types=1);

/**
 * POST /api/auth/register.php
 * Registers a new user account in MySQL using PHP password_hash() (BCRYPT).
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../utils/helpers.php';

handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed. Use POST.', 405);
}

$input = getJsonInput();
$name = trim((string)($input['name'] ?? ''));
$email = strtolower(trim((string)($input['email'] ?? '')));
$phone = trim((string)($input['phone'] ?? ''));
$password = (string)($input['password'] ?? '');
$city = trim((string)($input['city'] ?? 'Bengaluru')) ?: 'Bengaluru';

if ($name === '' || $email === '' || $phone === '' || $password === '') {
    sendError('Please complete all required registration fields.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendError('Please enter a valid email address.');
}

if (strlen($password) < 6) {
    sendError('Password must be at least 6 characters long.');
}

$pdo = getDbConnection();

// Check for duplicate email
$dupStmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1');
$dupStmt->execute([':email' => $email]);
if ($dupStmt->fetch()) {
    sendError('An account with this email address is already registered.', 409);
}

$userId = 'usr-' . substr(bin2hex(random_bytes(6)), 0, 10);
$passwordHash = password_hash($password, PASSWORD_BCRYPT);
$initials = computeInitials($name);

$insertStmt = $pdo->prepare("
    INSERT INTO users (id, name, email, phone, password_hash, role, avatar_initials, city, rating, created_at)
    VALUES (:id, :name, :email, :phone, :password_hash, 'USER', :initials, :city, 5.00, UTC_TIMESTAMP())
");
$insertStmt->execute([
    ':id'            => $userId,
    ':name'          => $name,
    ':email'         => $email,
    ':phone'         => $phone,
    ':password_hash' => $passwordHash,
    ':initials'      => $initials,
    ':city'          => $city,
]);

createNotification(
    $pdo,
    $userId,
    'Account Created',
    'Welcome to VeloRent. You can now rent vehicles or list your own vehicle on the marketplace.',
    'SUCCESS',
    '/rent'
);

$userStmt = $pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
$userStmt->execute([':id' => $userId]);
$newUserRow = $userStmt->fetch();

$token = issueAuthToken($pdo, $userId);

sendJson([
    'success' => true,
    'token'   => $token,
    'user'    => formatUserRow($newUserRow),
], 201);
