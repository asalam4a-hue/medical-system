<?php
require_once __DIR__ . '/layout.php';
require_login();
$r = $_GET['r'] ?? 'rep_visits';
if (!isset(REPORTS[$r])) $r = 'rep_visits';
require_perm($r);
$pdo = db();

$from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') ? $_GET['from'] : date('Y-m-01');
$to   = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '') ? $_GET['to'] : date('Y-m-d');
$doc  = (int)($_GET['doctor'] ?? 0);
$typ  = array_key_exists($_GET['type'] ?? '', VISIT_TYPES) ? $_GET['type'] : '';
$ins  = (int)($_GET['insurer'] ?? 0);

$w = ['v.visit_date BETWEEN :f AND :t']; $p = ['f' => $from, 't' => $to];
if ($doc) { $w[] = 'v.doctor_id=:d'; $p['d'] = $doc; }
if ($typ) { $w[] = 'v.visit_type=:ty'; $p['ty'] = $typ; }
if ($ins) { $w[] = 'v.insurer_id=:i'; $p['i'] = $ins; }
$W = implode(' AND ', $w);
$q = function (string $sql) use ($pdo, $p) { $s = $pdo->prepare($sql); $s->execute($p); return $s->fetchAll(); };
$patient = "CASE WHEN v.visit_type='company' THEN v.value*COALESCE(v.share_pct,0)/100.0 ELSE v.value END";

$head = []; $rows = []; $tot = [];
if ($r === 'rep_visits') {
    $head = ['التاريخ', 'اليوم', 'المريض', 'الخدمة', 'الطبيب', 'النوع', 'شركة التأمين', 'القيمة', 'مبلغ المريض', 'مبلغ الشركة'];
    foreach ($q("SELECT v.*, p.name pn, s.name sn, d.name dn, i.name inn, $patient AS pat FROM visits v JOIN patients p ON p.id=v.patient_id JOIN services s ON s.id=v.service_id LEFT JOIN doctors d ON d.id=v.doctor_id LEFT JOIN insurers i ON i.id=v.insurer_id WHERE $W ORDER BY v.visit_date, v.id") as $x)
        $rows[] = [$x['visit_date'], $x['day_name'], $x['pn'], $x['sn'], $x['dn'] ?? '', VISIT_TYPES[$x['visit_type']] ?? '', $x['inn'] ?? '', (float)$x['value'], (float)$x['pat'], $x['value'] - $x['pat']];
    $tot = [7, 8, 9];
} elseif ($r === 'rep_doctors') {
    $head = ['الكود', 'الطبيب', 'العيادة', 'عدد الزيارات', 'إجمالي الإيراد', 'النسبة %', 'مستحق النسبة', 'الفكسيد', 'إجمالي المستحق'];
    $ds = $pdo->query('SELECT * FROM doctors' . ($doc ? ' WHERE id=' . $doc : '') . ' ORDER BY name')->fetchAll();
    foreach ($ds as $d) {
        $c = doctor_due($d, $from, $to);
        $rows[] = [$d['code'], $d['name'], $d['clinic'] ?? '', $c['visits'], $c['total'], (float)$d['percentage'], $c['share'], $c['fixed'], $c['due']];
    }
    $tot = [3, 4, 6, 7, 8];
} elseif ($r === 'rep_services') {
    $head = ['النوع', 'الخدمة', 'عدد المرات', 'الإجمالي'];
    foreach ($q("SELECT s.type, s.name, COUNT(*) c, SUM(v.value) tv FROM visits v JOIN services s ON s.id=v.service_id WHERE $W GROUP BY s.id ORDER BY s.type, tv DESC") as $x)
        $rows[] = [SERVICE_TYPES[$x['type']] ?? $x['type'], $x['name'], (int)$x['c'], (float)$x['tv']];
    $tot = [2, 3];
} else {
    $head = ['شركة التأمين', 'عدد الزيارات', 'إجمالي القيمة', 'مبلغ المرضى', 'مستحق على الشركة'];
    foreach ($q("SELECT i.name, COUNT(*) c, SUM(v.value) tv, SUM($patient) pt FROM visits v JOIN insurers i ON i.id=v.insurer_id WHERE $W AND v.visit_type='company' GROUP BY i.id ORDER BY i.name") as $x)
        $rows[] = [$x['name'], (int)$x['c'], (float)$x['tv'], (float)$x['pt'], $x['tv'] - $x['pt']];
    $tot = [1, 2, 3, 4];
}

/* تصدير CSV (يفتح في Excel بالعربية) */
if (isset($_GET['export'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $r . '_' . date('Ymd') . '.csv"');
    echo "\xEF\xBB\xBF";
    $o = fopen('php://output', 'w');
    $safe = fn($v) => is_string($v) && preg_match('/^[=+\-@]/', $v) ? "'" . $v : $v;
    fputcsv($o, $head);
    foreach ($rows as $row) fputcsv($o, array_map($safe, $row));
    exit;
}

page_header(REPORTS[$r]);
$docs = $pdo->query('SELECT id, name FROM doctors ORDER BY name')->fetchAll();
$inss = $pdo->query('SELECT id, name FROM insurers ORDER BY name')->fetchAll();
echo '<form method="get" class="card inline no-print" style="display:flex">';
echo '<input type="hidden" name="r" value="' . e($r) . '">';
echo '<label>من <input type="date" name="from" value="' . e($from) . '"></label><label>إلى <input type="date" name="to" value="' . e($to) . '"></label>';
echo '<label>الطبيب <select name="doctor"><option value="0">الكل</option>';
foreach ($docs as $d) echo '<option value="' . $d['id'] . '"' . ($doc === (int)$d['id'] ? ' selected' : '') . '>' . e($d['name']) . '</option>';
echo '</select></label>';
if ($r === 'rep_visits' || $r === 'rep_services') {
    echo '<label>النوع <select name="type"><option value="">الكل</option>';
    foreach (VISIT_TYPES as $k => $l) echo '<option value="' . $k . '"' . ($typ === $k ? ' selected' : '') . '>' . e($l) . '</option>';
    echo '</select></label><label>الشركة <select name="insurer"><option value="0">الكل</option>';
    foreach ($inss as $d) echo '<option value="' . $d['id'] . '"' . ($ins === (int)$d['id'] ? ' selected' : '') . '>' . e($d['name']) . '</option>';
    echo '</select></label>';
}
$qs = http_build_query(['r' => $r, 'from' => $from, 'to' => $to, 'doctor' => $doc, 'type' => $typ, 'insurer' => $ins, 'export' => 1]);
echo '<button class="btn pri">عرض</button><a class="btn" href="?' . e($qs) . '">⬇️ تصدير Excel</a><button type="button" class="btn" onclick="window.print()">🖨️ طباعة</button></form>';

echo '<div class="card"><div style="text-align:center;margin-bottom:10px"><b>' . e(setting('center_name', 'المركز الطبي')) . '</b><br>' . e(REPORTS[$r]) . ' — من ' . e($from) . ' إلى ' . e($to) . '</div>';
echo '<div class="tw"><table class="tbl"><thead><tr><th>#</th>';
foreach ($head as $h) echo '<th>' . e($h) . '</th>';
echo '</tr></thead><tbody>';
if (!$rows) echo '<tr><td colspan="' . (count($head) + 1) . '" class="muted c">لا توجد بيانات في هذه الفترة.</td></tr>';
$sums = array_fill_keys($tot, 0.0);
foreach ($rows as $i => $row) {
    echo '<tr><td>' . ($i + 1) . '</td>';
    foreach ($row as $ci => $v) {
        if (isset($sums[$ci])) $sums[$ci] += $v;
        echo is_float($v) || is_int($v) ? '<td class="num">' . (is_int($v) ? $v : money($v)) . '</td>' : '<td>' . e($v) . '</td>';
    }
    echo '</tr>';
}
echo '</tbody>';
if ($rows) {
    echo '<tfoot><tr><td></td>';
    foreach ($head as $ci => $_) echo isset($sums[$ci]) ? '<td class="num">' . (in_array($r, ['rep_services', 'rep_insurers']) && $ci === 1 && $r === 'rep_insurers' || ($r === 'rep_doctors' && $ci === 3) || ($r === 'rep_services' && $ci === 2) ? (int)$sums[$ci] : money($sums[$ci])) . '</td>' : '<td>' . ($ci === 0 ? 'الإجمالي' : '') . '</td>';
    echo '</tr></tfoot>';
}
echo '</table></div></div>';
page_footer();
