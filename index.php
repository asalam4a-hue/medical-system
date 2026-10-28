<?php
require_once __DIR__ . '/layout.php';
require_login();
$pdo = db();
$today = date('Y-m-d'); $m1 = date('Y-m-01'); $m2 = date('Y-m-t');
$one = fn(string $sql, array $p = []) => (function () use ($pdo, $sql, $p) { $s = $pdo->prepare($sql); $s->execute($p); return $s->fetchColumn(); })();

$k = [
    ['زيارات اليوم', (int)$one('SELECT COUNT(*) FROM visits WHERE visit_date=?', [$today])],
    ['إيراد اليوم', money($one('SELECT COALESCE(SUM(value),0) FROM visits WHERE visit_date=?', [$today]))],
    ['زيارات الشهر', (int)$one('SELECT COUNT(*) FROM visits WHERE visit_date BETWEEN ? AND ?', [$m1, $m2])],
    ['إيراد الشهر', money($one('SELECT COALESCE(SUM(value),0) FROM visits WHERE visit_date BETWEEN ? AND ?', [$m1, $m2]))],
    ['المرضى', (int)$one('SELECT COUNT(*) FROM patients')],
    ['الأطباء', (int)$one('SELECT COUNT(*) FROM doctors')],
    ['العاملون', (int)$one('SELECT COUNT(*) FROM staff')],
];
$days = [];
for ($i = 6; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i day"));
    $days[] = [$d, (float)$one('SELECT COALESCE(SUM(value),0) FROM visits WHERE visit_date=?', [$d])];
}
$max = max(1, ...array_column($days, 1));
$recent = $pdo->query('SELECT v.visit_date, p.name patient, s.name service, d.name doctor, v.value FROM visits v JOIN patients p ON p.id=v.patient_id JOIN services s ON s.id=v.service_id LEFT JOIN doctors d ON d.id=v.doctor_id ORDER BY v.id DESC LIMIT 8')->fetchAll();

page_header('لوحة التحكم');
echo '<div class="cards">';
foreach ($k as [$l, $v]) echo '<div class="kpi"><small>' . e($l) . '</small><b>' . e($v) . '</b></div>';
echo '</div><div class="card"><b>الإيراد آخر 7 أيام</b><div class="bars">';
foreach ($days as [$d, $v]) echo '<div><span style="height:' . max(3, round($v / $max * 110)) . 'px"></span>' . e(money($v)) . '<br><small class="muted">' . e(day_name($d)) . '</small></div>';
echo '</div></div><div class="card"><b>آخر الزيارات</b><div class="tw"><table class="tbl"><thead><tr><th>التاريخ</th><th>المريض</th><th>الخدمة</th><th>الطبيب</th><th>القيمة</th></tr></thead><tbody>';
if (!$recent) echo '<tr><td colspan="5" class="muted c">لا توجد زيارات بعد.</td></tr>';
foreach ($recent as $r) echo '<tr><td>' . e($r['visit_date']) . '</td><td>' . e($r['patient']) . '</td><td>' . e($r['service']) . '</td><td>' . e($r['doctor'] ?? '—') . '</td><td class="num">' . money($r['value']) . '</td></tr>';
echo '</tbody></table></div></div>';
page_footer();
