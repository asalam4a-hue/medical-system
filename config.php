<?php
declare(strict_types=1);
date_default_timezone_set('Africa/Cairo');
mb_internal_encoding('UTF-8');

define('BASE', __DIR__);
define('DATA_DIR', BASE . '/data');
define('UP_DIR', DATA_DIR . '/uploads');

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name('medc');
    session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]);
    session_start();
}

/* ---------- الشاشات والتقارير (مفاتيح الصلاحيات) ---------- */
const SCREENS = [
    'users'      => ['المستخدمين', 'users.php'],
    'staff'      => ['العاملين', 'staff.php'],
    'doctors'    => ['الأطباء', 'doctors.php'],
    'services'   => ['الخدمات', 'services.php'],
    'operations' => ['العمليات', 'operations.php'],
    'patients'   => ['المرضى', 'patients.php'],
    'insurers'   => ['شركات التأمين', 'insurers.php'],
    'visits'     => ['الزيارات', 'visits.php'],
    'settings'   => ['إعدادات المركز', 'settings.php'],
];
const REPORTS = [
    'rep_visits'   => 'تقرير الزيارات',
    'rep_doctors'  => 'تقرير الأطباء والمستحقات',
    'rep_services' => 'تقرير الخدمات',
    'rep_insurers' => 'تقرير شركات التأمين',
];
const ACTIONS = ['view' => 'عرض', 'add' => 'إضافة', 'edit' => 'تعديل', 'delete' => 'حذف'];
const VISIT_TYPES = ['cash' => 'نقدي', 'company' => 'شركة', 'committee' => 'لجنة', 'insurance' => 'تأمين'];
const SERVICE_TYPES = ['clinic' => 'عيادة', 'radiology' => 'أشعة', 'lab' => 'تحاليل'];

/* ---------- أدوات عامة ---------- */
function e($v): string { return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function ar2en(string $s): string {
    return strtr($s, ['٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9',
                      '۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٫'=>'.']);
}

function day_name(string $date): string {
    $map = ['Saturday'=>'السبت','Sunday'=>'الأحد','Monday'=>'الاثنين','Tuesday'=>'الثلاثاء',
            'Wednesday'=>'الأربعاء','Thursday'=>'الخميس','Friday'=>'الجمعة'];
    $ts = strtotime($date);
    return $ts ? $map[date('l', $ts)] : '';
}

function money($v): string { return number_format((float)$v, 2); }

function redirect(string $to): never { header('Location: ' . $to); exit; }

function flash(string $msg, string $type = 'ok'): void { $_SESSION['flash'][] = [$type, $msg]; }
function flashes(): array { $f = $_SESSION['flash'] ?? []; unset($_SESSION['flash']); return $f; }

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
    return $_SESSION['csrf'];
}
function csrf_field(): string { return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">'; }
function csrf_check(): void {
    if (!hash_equals($_SESSION['csrf'] ?? '', (string)($_POST['csrf'] ?? ''))) {
        http_response_code(419);
        exit('انتهت صلاحية الصفحة، أعد التحميل وحاول مرة أخرى.');
    }
}

/* ---------- قاعدة البيانات (SQLite - لا تحتاج إعداد) ---------- */
function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    foreach ([DATA_DIR, UP_DIR] as $d) if (!is_dir($d)) mkdir($d, 0750, true);
    if (!file_exists(DATA_DIR . '/.htaccess')) {
        file_put_contents(DATA_DIR . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nOrder deny,allow\nDeny from all\n</IfModule>\n");
        file_put_contents(DATA_DIR . '/index.html', '');
    }
    $pdo = new PDO('sqlite:' . DATA_DIR . '/medcenter.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');
    init_schema($pdo);
    return $pdo;
}

function init_schema(PDO $p): void {
    $p->exec("
    CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
        national_id TEXT, birth_date TEXT, is_admin INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
        perms TEXT NOT NULL DEFAULT '[]', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT);
    CREATE TABLE IF NOT EXISTS staff(
        id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT NOT NULL, national_id TEXT,
        id_photo TEXT, photo TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS doctors(
        id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT NOT NULL, clinic TEXT, id_number TEXT,
        id_photo TEXT, syndicate_photo TEXT, photo TEXT, hire_date TEXT,
        percentage REAL NOT NULL DEFAULT 0, fixed_amount REAL NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS services(
        id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS operations(
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0, notes TEXT);
    CREATE TABLE IF NOT EXISTS patients(
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS insurers(
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, exam_fee REAL NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS visits(
        id INTEGER PRIMARY KEY AUTOINCREMENT, visit_date TEXT NOT NULL, day_name TEXT,
        patient_id INTEGER NOT NULL REFERENCES patients(id), service_id INTEGER NOT NULL REFERENCES services(id),
        value REAL NOT NULL DEFAULT 0, doctor_id INTEGER REFERENCES doctors(id),
        visit_type TEXT NOT NULL DEFAULT 'cash', insurer_id INTEGER REFERENCES insurers(id),
        form_no TEXT, form_photo TEXT, card_no TEXT, card_photo TEXT, share_pct REAL, phone TEXT,
        last_visit_date TEXT, last_visit_type TEXT, created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS ix_visits_date ON visits(visit_date);
    CREATE INDEX IF NOT EXISTS ix_visits_patient ON visits(patient_id);
    CREATE INDEX IF NOT EXISTS ix_visits_doctor ON visits(doctor_id);
    CREATE TABLE IF NOT EXISTS login_attempts(ip TEXT, ts INTEGER);
    ");
    if ((int)$p->query('SELECT COUNT(*) FROM users')->fetchColumn() === 0) {
        $p->prepare('INSERT INTO users(username,password,is_admin,is_active) VALUES(?,?,1,1)')
          ->execute(['admin', password_hash('admin123', PASSWORD_DEFAULT)]);
    }
}

function setting(string $k, string $default = ''): string {
    static $cache = null;
    if ($cache === null) $cache = db()->query('SELECT k,v FROM settings')->fetchAll(PDO::FETCH_KEY_PAIR);
    return (string)($cache[$k] ?? $default);
}
function set_setting(string $k, string $v): void {
    db()->prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v')->execute([$k, $v]);
}

/* ---------- المستخدم والصلاحيات ---------- */
function user(): ?array {
    static $u = false;
    if ($u !== false) return $u;
    $u = null;
    if (!empty($_SESSION['uid'])) {
        $st = db()->prepare('SELECT * FROM users WHERE id=? AND is_active=1');
        $st->execute([$_SESSION['uid']]);
        $row = $st->fetch();
        if ($row) { $row['perm_list'] = json_decode($row['perms'] ?: '[]', true) ?: []; $u = $row; }
    }
    return $u;
}
function require_login(): array {
    $u = user();
    if (!$u) redirect('login.php');
    return $u;
}
function can(string $key, string $action = 'view'): bool {
    $u = user();
    if (!$u) return false;
    if ($u['is_admin']) return true;
    $needle = str_starts_with($key, 'rep_') ? $key : "$key.$action";
    return in_array($needle, $u['perm_list'], true);
}
function require_perm(string $key, string $action = 'view'): void {
    require_login();
    if (!can($key, $action)) {
        http_response_code(403);
        page_header('غير مصرح');
        echo '<div class="alert err">ليس لديك صلاحية للوصول إلى هذه الشاشة أو تنفيذ هذا الإجراء.</div>';
        page_footer();
        exit;
    }
}

/* ---------- رفع الصور (تُحفظ خارج المسار العام وتُعرض عبر file.php) ---------- */
function save_upload(string $field): ?string {
    $f = $_FILES[$field] ?? null;
    if (!$f || $f['error'] === UPLOAD_ERR_NO_FILE) return null;
    if ($f['error'] !== UPLOAD_ERR_OK) throw new RuntimeException('فشل رفع الصورة، حاول مرة أخرى.');
    if ($f['size'] > 5 * 1024 * 1024) throw new RuntimeException('حجم الصورة أكبر من 5 ميجابايت.');
    $info = @getimagesize($f['tmp_name']);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$info['mime'] ?? ''] ?? null;
    if (!$ext) throw new RuntimeException('الملفات المسموحة: صور JPG أو PNG أو WEBP فقط.');
    $name = bin2hex(random_bytes(12)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], UP_DIR . '/' . $name)) throw new RuntimeException('تعذر حفظ الصورة.');
    return $name;
}
function delete_upload(?string $name): void {
    if ($name && preg_match('/^[a-f0-9]{24}\.(jpg|png|webp)$/', $name)) @unlink(UP_DIR . '/' . $name);
}
function img_tag(?string $name, int $h = 38): string {
    if (!$name) return '<span class="muted">—</span>';
    $u = 'file.php?f=' . rawurlencode($name);
    return '<a href="' . e($u) . '" target="_blank"><img class="thumb" style="height:' . $h . 'px" src="' . e($u) . '" alt=""></a>';
}

/* ---------- حسابات ---------- */
function doctor_due(array $d, ?string $from = null, ?string $to = null): array {
    $from = $from ?: date('Y-m-01');
    $to   = $to   ?: date('Y-m-t');
    $st = db()->prepare('SELECT COUNT(*) c, COALESCE(SUM(value),0) s FROM visits WHERE doctor_id=? AND visit_date BETWEEN ? AND ?');
    $st->execute([$d['id'], $from, $to]);
    $r = $st->fetch();
    $share = $r['s'] * ((float)$d['percentage']) / 100;
    return ['visits' => (int)$r['c'], 'total' => (float)$r['s'], 'share' => $share, 'fixed' => (float)$d['fixed_amount'],
            'due' => $share + (float)$d['fixed_amount']];
}
