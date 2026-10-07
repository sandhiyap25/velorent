<?php
declare(strict_types=1);

/**
 * POST /api/uploads/upload.php
 * Handles image/evidence file uploads (multipart/form-data) for vehicles,
 * damage inspections, and incident reports.
 */

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed. Use POST.', 405);
}

$pdo = getDbConnection();
requireAuth($pdo);

if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    sendError('No file uploaded.');
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    sendError('File upload failed with error code ' . (int)$file['error']);
}

$maxBytes = 5 * 1024 * 1024; // 5 MB
if ($file['size'] > $maxBytes) {
    sendError('File exceeds maximum allowed size of 5 MB.');
}

$allowedMimeTypes = [
    'image/jpeg'      => 'jpg',
    'image/png'       => 'png',
    'image/webp'      => 'webp',
    'application/pdf' => 'pdf',
];

$mime = '';
if (class_exists('finfo')) {
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = (string)$finfo->file($file['tmp_name']);
} elseif (function_exists('mime_content_type')) {
    $mime = (string)mime_content_type($file['tmp_name']);
} else {
    $mime = (string)($file['type'] ?? '');
}

if (!isset($allowedMimeTypes[$mime])) {
    sendError('Unsupported file format. Allowed: JPG, PNG, WEBP, PDF.');
}

$ext = $allowedMimeTypes[$mime];
$uploadDir = __DIR__ . '/../../uploads';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$filename = 'upload_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$destination = $uploadDir . '/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    sendError('Failed to save uploaded file on server.', 500);
}

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$scriptDir = dirname(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/velorent/backend/api/uploads/upload.php')));
$publicUrl = rtrim("{$scheme}://{$host}{$scriptDir}", '/') . '/uploads/' . $filename;

sendJson([
    'success'  => true,
    'filename' => $filename,
    'url'      => $publicUrl,
], 201);
