<?php
/* عرض الصور المرفوعة: مسموح للمسجلين فقط (عدا شعار المركز لشاشة الدخول) */
require_once __DIR__ . '/config.php';
$f = (string)($_GET['f'] ?? '');
if (!preg_match('/^[a-f0-9]{24}\.(jpg|png|webp)$/', $f)) { http_response_code(404); exit; }
if ($f !== setting('logo') && !user()) { http_response_code(403); exit; }
$path = UP_DIR . '/' . $f;
if (!is_file($path)) { http_response_code(404); exit; }
$types = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
header('Content-Type: ' . $types[pathinfo($f, PATHINFO_EXTENSION)]);
header('Content-Length: ' . filesize($path));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=86400');
readfile($path);
