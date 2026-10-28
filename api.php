<?php
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
if (!user() || !can('visits', 'view')) { http_response_code(403); echo '{}'; exit; }

if (($_GET['a'] ?? '') === 'patient') {
    $id = (int)($_GET['id'] ?? 0); $skip = (int)($_GET['skip'] ?? 0);
    $p = db()->prepare('SELECT phone FROM patients WHERE id=?'); $p->execute([$id]);
    $phone = $p->fetchColumn();
    $v = db()->prepare('SELECT visit_date, visit_type FROM visits WHERE patient_id=? AND id<>? ORDER BY visit_date DESC, id DESC LIMIT 1');
    $v->execute([$id, $skip]); $last = $v->fetch();
    echo json_encode([
        'phone' => $phone ?: '',
        'last_date' => $last['visit_date'] ?? '',
        'last_type' => $last ? (VISIT_TYPES[$last['visit_type']] ?? $last['visit_type']) : '',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
echo '{}';
