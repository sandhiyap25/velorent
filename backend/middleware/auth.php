<?php
declare(strict_types=1);

/**
 * VeloRent — Authentication & Authorization Middleware
 * Supports both PHP Sessions and Bearer Tokens stored in MySQL `auth_tokens`.
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';

function startSecureSession(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 86400 * 7,
            'path'     => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        @session_start();
    }
}

function extractBearerToken(): ?string
{
    $headers = [];
    if (function_exists('getallheaders')) {
        $headers = getallheaders() ?: [];
    }

    $authHeader = $headers['Authorization']
        ?? $headers['authorization']
        ?? $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';

    if (preg_match('/^Bearer\s+(.+)$/i', trim((string)$authHeader), $matches)) {
        return trim($matches[1]);
    }
    return null;
}

function issueAuthToken(PDO $pdo, string $userId): string
{
    startSecureSession();
    $_SESSION['user_id'] = $userId;

    $rawToken = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $rawToken);
    $expiresAt = gmdate('Y-m-d H:i:s', time() + 86400 * 7);

    // Clean up expired tokens occasionally
    $pdo->prepare('DELETE FROM auth_tokens WHERE expires_at < UTC_TIMESTAMP()')->execute();

    $stmt = $pdo->prepare('
        INSERT INTO auth_tokens (user_id, token_hash, expires_at)
        VALUES (:user_id, :token_hash, :expires_at)
    ');
    $stmt->execute([
        ':user_id'    => $userId,
        ':token_hash' => $tokenHash,
        ':expires_at' => $expiresAt,
    ]);

    return $rawToken;
}

function revokeCurrentAuthToken(PDO $pdo): void
{
    startSecureSession();
    $bearer = extractBearerToken();
    if ($bearer !== null) {
        $tokenHash = hash('sha256', $bearer);
        $stmt = $pdo->prepare('DELETE FROM auth_tokens WHERE token_hash = :token_hash');
        $stmt->execute([':token_hash' => $tokenHash]);
    }

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            (bool)$params['secure'],
            (bool)$params['httponly']
        );
    }
    @session_destroy();
}

function getAuthenticatedUser(PDO $pdo): ?array
{
    startSecureSession();

    // 1. Check Bearer token first (works seamlessly across ports in Vite + XAMPP)
    $bearer = extractBearerToken();
    if ($bearer !== null && $bearer !== '') {
        $tokenHash = hash('sha256', $bearer);
        $stmt = $pdo->prepare('
            SELECT u.*
            FROM auth_tokens t
            INNER JOIN users u ON u.id = t.user_id
            WHERE t.token_hash = :token_hash
              AND t.expires_at > UTC_TIMESTAMP()
            LIMIT 1
        ');
        $stmt->execute([':token_hash' => $tokenHash]);
        $user = $stmt->fetch();
        if ($user) {
            $_SESSION['user_id'] = $user['id'];
            return $user;
        }
    }

    // 2. Fallback to native PHP session
    if (!empty($_SESSION['user_id'])) {
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $_SESSION['user_id']]);
        $user = $stmt->fetch();
        if ($user) {
            return $user;
        }
    }

    return null;
}

function requireAuth(PDO $pdo): array
{
    $user = getAuthenticatedUser($pdo);
    if (!$user) {
        sendError('Authentication required. Please sign in to continue.', 401);
    }
    return $user;
}

function requireAdmin(PDO $pdo): array
{
    $user = requireAuth($pdo);
    if (($user['role'] ?? 'USER') !== 'ADMIN') {
        sendError('Administrator privileges are required for this action.', 403);
    }
    return $user;
}
