<?php
declare(strict_types=1);

/**
 * POST /api/auth/login.php
 * Authenticates a user against MySQL using PHP password_verify().
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
$email = strtolower(trim((string)($input['email'] ?? '')));
$password = (string)($input['password'] ?? '');

if ($email === '' || $password === '') {
    sendError('Please enter both your email address and password.');
}

$pdo = getDbConnection();

$stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(email) = :email LIMIT 1');
$stmt->execute([':email' => $email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, (string)$user['password_hash'])) {
    sendError('Invalid email or password. Please check your credentials.', 401);
}

$token = issueAuthToken($pdo, (string)$user['id']);

sendJson([
    'success' => true,
    'token'   => $token,
    'user'    => formatUserRow($user),
]);
