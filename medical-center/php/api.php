<?php
/* واجهة برنامج إدارة المركز الطبي — PHP + SQLite (PDO).
   نفس أوامر ملف api.js: status, register, login, me, logout, list, save, delete, upload, file */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

/* غيّر المسار إلى مجلد خارج الجذر العام للموقع إن أمكن (مثال: /home/user/mc_data) */
$DATA = getenv('MC_DATA_DIR') ?: (__DIR__ . '/data');
$TOKEN_TTL = 12 * 3600;

/* صفحة تشخيص: افتح api.php في المتصفح لمعرفة حالة الاستضافة */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
  $okDir = (is_dir($DATA) || @mkdir($DATA, 0700, true)) && is_writable($DATA);
  jout(['app' => 'medical-center', 'php' => PHP_VERSION, 'pdo_sqlite' => extension_loaded('pdo_sqlite'), 'mbstring' => extension_loaded('mbstring'), 'curl' => extension_loaded('curl'), 'data_dir_writable' => $okDir, 'gas_proxy' => is_file(__DIR__ . '/gas_url.txt') && trim((string)file_get_contents(__DIR__ . '/gas_url.txt')) !== '', 'seed_json' => is_file(__DIR__ . '/seed.json'), 'ok' => extension_loaded('pdo_sqlite') && $okDir]);
}

/* ربط مع جوجل شيت: ضع رابط نشر Google Apps Script (ينتهي بـ /exec) في ملف gas_url.txt بجوار هذا الملف
   أو في المتغير MC_GAS_URL، فتعمل كل النسخ (ويب/أندرويد/جوجل) على نفس قاعدة البيانات. */
$GAS = trim((string)(getenv('MC_GAS_URL') ?: (is_file(__DIR__ . '/gas_url.txt') ? file_get_contents(__DIR__ . '/gas_url.txt') : '')));
if ($GAS !== '' && preg_match('#^https://script\.google\.com/#', $GAS) && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $ch = curl_init($GAS);
  curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => file_get_contents('php://input', false, null, 0, 9000000), CURLOPT_HTTPHEADER => ['Content-Type: text/plain;charset=utf-8'], CURLOPT_FOLLOWLOCATION => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60]);
  $out = curl_exec($ch);
  if ($out === false) { echo json_encode(['error' => 'تعذر الاتصال بجوجل شيت'], JSON_UNESCAPED_UNICODE); exit; }
  echo $out; exit;
}

if (!function_exists('mb_strlen')) { function mb_strlen($s) { return preg_match_all('/./us', (string)$s) ?: 0; } }
if (!function_exists('mb_strtolower')) { function mb_strtolower($s) { return strtolower((string)$s); } }
if (!function_exists('mb_substr')) { function mb_substr($s, $a, $l = null) { $c = preg_split('//u', (string)$s, -1, PREG_SPLIT_NO_EMPTY) ?: []; return implode('', array_slice($c, $a, $l)); } }
function jout(array $a): void { echo json_encode($a, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function jerr(string $m, ?string $code = null): void { jout(['error' => $m, 'code' => $code]); }

const ENT = ['users','staff','doctors','services','operations','patients','companies','visits','expenses'];
const LOOKUP = ['doctors','services','patients','companies'];
const WRITE = ['staff'=>['staff'],'doctors'=>['doctors'],'services'=>['services'],'operations'=>['operations'],'patients'=>['patients','visits'],'companies'=>['companies'],'visits'=>['visits'],'expenses'=>['expenses','dues']];
const FIELDS = [
  'users'=>'username,nationalId,birthDate,perms,isAdmin,active',
  'staff'=>'code,name,nationalId,idPhoto,photo',
  'doctors'=>'code,name,clinic,phone,nationalId,idPhoto,syndicatePhoto,photo,hireDate,percent,fixed,opPercent',
  'services'=>'type,name,price,tax',
  'operations'=>'date,patient,operation,clinic,doctor,doctorId,value,doctorPercent,notes,anesthetist,anesthetistId,anesthesia,deductAnes',
  'patients'=>'name,phone',
  'companies'=>'name,fee,contact',
  'visits'=>'serial,date,patient,phone,clinic,doctor,doctorId,visitType,service,value,tax,category,company,formNo,formPhoto,cardNo,cardPhoto,nationalId,patientPct,discount,notes',
  'expenses'=>'date,category,amount,notes,doctor,dueDate,docNo',
];
const NUMS = ['percent','fixed','opPercent','price','tax','value','doctorPercent','fee','patientPct','discount','amount','code','serial','anesthesia'];
const DATES = ['date','hireDate','birthDate','dueDate'];
const AUTO = ['staff'=>'code','doctors'=>'code','visits'=>'serial'];

if (!is_dir($DATA)) { @mkdir($DATA, 0700, true); }
if (!is_dir($DATA . '/uploads')) { @mkdir($DATA . '/uploads', 0700, true); }
@file_put_contents($DATA . '/.htaccess', "Require all denied\nDeny from all\n");
if (!file_exists($DATA . '/index.html')) { @file_put_contents($DATA . '/index.html', ''); }

try {
  $db = new PDO('sqlite:' . $DATA . '/clinic.sqlite');
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=8000;');
  $db->exec("CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, entity TEXT NOT NULL, dt TEXT, data TEXT NOT NULL, created TEXT);
    CREATE INDEX IF NOT EXISTS ix_rec ON records(entity, dt);
    CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, mime TEXT);
    CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY, uid TEXT, exp INTEGER);
    CREATE TABLE IF NOT EXISTS fails(u TEXT PRIMARY KEY, n INTEGER, t INTEGER);
    CREATE TABLE IF NOT EXISTS counters(k TEXT PRIMARY KEY, v INTEGER);");

  $raw = file_get_contents('php://input', false, null, 0, 9000000);
  $b = json_decode($raw ?: '', true);
  if (!is_array($b)) jerr('طلب غير صالح');
  handle($db, $b);
} catch (Throwable $e) {
  error_log('MC api: ' . $e->getMessage());
  jerr('خطأ في الخادم');
}

/* ---------- أدوات ---------- */
function rid(): string { return bin2hex(random_bytes(9)); }
function validDate($s): bool { if (!is_string($s) || !preg_match('#^(\d{4})/(\d{2})/(\d{2})$#', $s, $m)) return false; return checkdate((int)$m[2], (int)$m[3], (int)$m[1]); }
function has(array $u, string $p): bool { return !empty($u['isAdmin']) || in_array($p, $u['perms'] ?? [], true); }
function getAll(PDO $db, string $e, ?string $from = null, ?string $to = null): array {
  $sql = 'SELECT id,data FROM records WHERE entity=?'; $args = [$e];
  if ($from) { $sql .= " AND (dt IS NULL OR dt='' OR dt>=?)"; $args[] = $from; }
  if ($to) { $sql .= " AND (dt IS NULL OR dt='' OR dt<=?)"; $args[] = $to; }
  $st = $db->prepare($sql . ' ORDER BY rowid'); $st->execute($args); $out = [];
  foreach ($st as $r) { $d = json_decode($r['data'], true) ?: []; $d['id'] = $r['id']; $out[] = $d; }
  return $out;
}
function getOne(PDO $db, string $e, string $id): ?array {
  $st = $db->prepare('SELECT id,data FROM records WHERE entity=? AND id=?'); $st->execute([$e, $id]); $r = $st->fetch(PDO::FETCH_ASSOC);
  if (!$r) return null; $d = json_decode($r['data'], true) ?: []; $d['id'] = $r['id']; return $d;
}
function putRec(PDO $db, string $e, array $rec): void {
  $id = $rec['id']; unset($rec['id']);
  $dt = isset($rec['date']) && is_string($rec['date']) ? $rec['date'] : null;
  $st = $db->prepare('INSERT INTO records(id,entity,dt,data,created) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET dt=excluded.dt, data=excluded.data');
  $st->execute([$id, $e, $dt, json_encode($rec, JSON_UNESCAPED_UNICODE), gmdate('c')]);
}
function pub(array $u): array { unset($u['hash']); return $u; }
function nextCounter(PDO $db, string $e, string $f): int {
  $st = $db->prepare('SELECT v FROM counters WHERE k=?'); $st->execute([$e]); $v = $st->fetchColumn();
  if ($v === false) { $v = 0; foreach (getAll($db, $e) as $r) $v = max($v, (int)($r[$f] ?? 0)); }
  $v = (int)$v + 1;
  $db->prepare('INSERT INTO counters(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v')->execute([$e, $v]);
  return $v;
}
function seedData(PDO $db): void {
  $f = __DIR__ . '/seed.json'; if (!is_file($f)) return; $S = json_decode((string)file_get_contents($f), true); if (!is_array($S)) return;
  foreach (['services','doctors','companies','staff'] as $e) foreach (($S[$e] ?? []) as $r) {
    $r['id'] = rid(); $r['createdAt'] = gmdate('c'); if (isset(AUTO[$e])) $r[AUTO[$e]] = nextCounter($db, $e, AUTO[$e]); putRec($db, $e, $r);
  }
}

/* ---------- المعالج الرئيسي ---------- */
function handle(PDO $db, array $b): void {
  global $TOKEN_TTL, $DATA;
  $A = (string)($b['action'] ?? '');
  $users = getAll($db, 'users');
  if ($A === 'status') jout(['hasUsers' => count($users) > 0]);

  if ($A === 'register') {
    $u = trim((string)($b['username'] ?? '')); $p = (string)($b['password'] ?? '');
    if (mb_strlen($u) < 3 || mb_strlen($p) < 4) jerr('اسم المستخدم 3 أحرف على الأقل وكلمة السر 4 أحرف على الأقل');
    if (mb_strlen($u) > 40 || mb_strlen($p) > 200) jerr('بيانات طويلة');
    foreach ($users as $x) if (mb_strtolower($x['username']) === mb_strtolower($u)) jerr('اسم المستخدم موجود بالفعل');
    $db->exec('BEGIN IMMEDIATE');
    $first = count(getAll($db, 'users')) === 0;
    $bd = (string)($b['birthDate'] ?? '');
    putRec($db, 'users', ['id' => rid(), 'username' => $u, 'hash' => password_hash($p, PASSWORD_DEFAULT), 'nationalId' => mb_substr((string)($b['nationalId'] ?? ''), 0, 20), 'birthDate' => validDate($bd) ? $bd : '', 'perms' => $first ? ['*'] : [], 'isAdmin' => $first, 'active' => $first, 'createdAt' => gmdate('c')]);
    if ($first) seedData($db);
    $db->exec('COMMIT');
    jout(['ok' => true, 'pending' => !$first]);
  }

  if ($A === 'login') {
    $u = mb_strtolower(trim((string)($b['username'] ?? '')));
    $st = $db->prepare('SELECT n,t FROM fails WHERE u=?'); $st->execute([$u]); $f = $st->fetch(PDO::FETCH_ASSOC) ?: ['n' => 0, 't' => 0];
    if ($f['n'] >= 5 && time() - (int)$f['t'] < 600) jerr('محاولات كثيرة، حاول بعد 10 دقائق');
    $rec = null; foreach ($users as $x) if (mb_strtolower($x['username']) === $u) $rec = $x;
    if (!$rec || !password_verify((string)($b['password'] ?? ''), $rec['hash'] ?? '')) {
      $n = ((time() - (int)$f['t'] < 600) ? (int)$f['n'] : 0) + 1;
      $db->prepare('INSERT INTO fails(u,n,t) VALUES(?,?,?) ON CONFLICT(u) DO UPDATE SET n=excluded.n,t=excluded.t')->execute([$u, $n, time()]);
      jerr('اسم المستخدم أو كلمة السر غير صحيحة');
    }
    if (empty($rec['active'])) jerr('حسابك بانتظار موافقة المدير', 'pending');
    $db->prepare('DELETE FROM fails WHERE u=?')->execute([$u]);
    $db->prepare('DELETE FROM tokens WHERE exp<?')->execute([time()]);
    $t = bin2hex(random_bytes(24));
    $db->prepare('INSERT INTO tokens(token,uid,exp) VALUES(?,?,?)')->execute([hash('sha256', $t), $rec['id'], time() + $TOKEN_TTL]);
    jout(['token' => $t, 'user' => pub($rec)]);
  }

  $tk = hash('sha256', (string)($b['token'] ?? ''));
  $st = $db->prepare('SELECT uid FROM tokens WHERE token=? AND exp>?'); $st->execute([$tk, time()]); $uid = $st->fetchColumn();
  $me = null; if ($uid) foreach ($users as $x) if ($x['id'] === $uid && !empty($x['active'])) $me = $x;
  if (!$me) jerr('انتهت الجلسة، سجل الدخول من جديد', 'auth');
  $me['perms'] = $me['perms'] ?? [];

  if ($A === 'me') jout(['user' => pub($me)]);
  if ($A === 'logout') { $db->prepare('DELETE FROM tokens WHERE token=?')->execute([$tk]); jout(['ok' => true]); }

  $e = (string)($b['entity'] ?? '');
  if (in_array($A, ['list', 'save', 'delete'], true) && !in_array($e, ENT, true)) jerr('كيان غير معروف');

  if ($A === 'list') {
    $reps = false; foreach ($me['perms'] as $p) if (strpos($p, 'rep_') === 0) $reps = true;
    $ok = !empty($me['isAdmin']) || ($e !== 'users' && ($e === 'staff' ? has($me, 'staff') : (in_array($e, LOOKUP, true) || has($me, $e) || has($me, 'dashboard') || has($me, 'dues') || $reps)));
    if (!$ok) jerr('غير مصرح', 'forbidden');
    $from = !empty($b['from']) ? (string)$b['from'] : null; $to = !empty($b['to']) ? (string)$b['to'] : null;
    $items = getAll($db, $e, $from, $to);
    if ($e === 'users') $items = array_map('pub', $items);
    jout(['items' => $items]);
  }

  if ($A === 'save' || $A === 'delete') {
    $ok = !empty($me['isAdmin']);
    if (!$ok && $e !== 'users') foreach (WRITE[$e] ?? [] as $p) if (has($me, $p)) $ok = true;
    if (!$ok) jerr('غير مصرح', 'forbidden');
    $db->exec('BEGIN IMMEDIATE');
    try {
      $res = ($A === 'delete') ? doDelete($db, $e, $me, (string)($b['id'] ?? '')) : doSave($db, $e, $me, is_array($b['record'] ?? null) ? $b['record'] : []);
      $db->exec('COMMIT');
    } catch (Throwable $x) { $db->exec('ROLLBACK'); throw $x; }
    jout($res);
  }

  if ($A === 'upload') {
    $mime = (string)($b['mime'] ?? ''); $data = (string)($b['data'] ?? '');
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) jerr('يسمح بالصور فقط');
    if (strlen($data) > 5500000) jerr('الصورة كبيرة جداً');
    $bin = base64_decode($data, true); if ($bin === false || strlen($bin) < 12) jerr('الصورة تالفة');
    $isJpg = substr($bin, 0, 3) === "\xFF\xD8\xFF"; $isPng = substr($bin, 0, 8) === "\x89PNG\r\n\x1a\n"; $isWebp = substr($bin, 0, 4) === 'RIFF' && substr($bin, 8, 4) === 'WEBP';
    if (!($isJpg || $isPng || $isWebp)) jerr('الملف ليس صورة صالحة');
    $can = !empty($me['isAdmin']); foreach (['staff','doctors','visits','patients','operations','companies','expenses'] as $p) if (has($me, $p)) $can = true;
    if (!$can) jerr('غير مصرح', 'forbidden');
    $id = rid(); file_put_contents($GLOBALS['DATA'] . '/uploads/' . $id . '.bin', $bin);
    $db->prepare('INSERT INTO files(id,mime) VALUES(?,?)')->execute([$id, $mime]);
    jout(['file' => $id]);
  }

  if ($A === 'file') {
    $id = (string)($b['id'] ?? ''); if (!preg_match('/^[0-9a-f]{18}$/', $id)) jerr('الملف غير موجود');
    $st = $db->prepare('SELECT mime FROM files WHERE id=?'); $st->execute([$id]); $m = $st->fetchColumn();
    $path = $GLOBALS['DATA'] . '/uploads/' . $id . '.bin'; if (!$m || !is_file($path)) jerr('الملف غير موجود');
    jout(['dataUrl' => 'data:' . $m . ';base64,' . base64_encode((string)file_get_contents($path))]);
  }
  jerr('أمر غير معروف');
}

function doDelete(PDO $db, string $e, array $me, string $id): array {
  $r = getOne($db, $e, $id); if (!$r) jerr('غير موجود');
  if ($e === 'users') {
    $admins = count(array_filter(getAll($db, 'users'), fn($x) => !empty($x['isAdmin']) && !empty($x['active'])));
    if ($r['id'] === $me['id'] || (!empty($r['isAdmin']) && $admins < 2)) jerr('لا يمكن حذف هذا المستخدم');
  }
  $db->prepare('DELETE FROM records WHERE entity=? AND id=?')->execute([$e, $id]);
  return ['ok' => true];
}

function doSave(PDO $db, string $e, array $me, array $src): array {
  $out = [];
  foreach (explode(',', FIELDS[$e]) as $k) {
    if (!array_key_exists($k, $src)) continue; $v = $src[$k];
    if ($k === 'perms') { $v = is_array($v) ? array_values(array_slice(array_map('strval', $v), 0, 60)) : []; }
    elseif ($k === 'isAdmin' || $k === 'active') { $v = (bool)$v; }
    elseif (in_array($k, NUMS, true)) { $v = is_numeric($v) ? $v + 0 : 0; }
    else {
      $v = mb_substr(trim(is_scalar($v) ? (string)$v : ''), 0, 500);
      if (in_array($k, DATES, true) && $v !== '' && !validDate($v)) jerr('صيغة التاريخ يجب أن تكون yyyy/mm/dd');
    }
    $out[$k] = $v;
  }
  $id = isset($src['id']) ? (string)$src['id'] : ''; $rec = $id !== '' ? getOne($db, $e, $id) : null;
  if ($e === 'users') {
    $nm = trim((string)($out['username'] ?? '')); if (mb_strlen($nm) < 3) jerr('اسم المستخدم قصير');
    $all = getAll($db, 'users');
    foreach ($all as $x) if ($x['id'] !== $id && mb_strtolower($x['username']) === mb_strtolower($nm)) jerr('اسم المستخدم موجود بالفعل');
    $pw = (string)($src['password'] ?? '');
    if (!$rec && mb_strlen($pw) < 4) jerr('كلمة السر 4 أحرف على الأقل');
    $admins = count(array_filter($all, fn($x) => !empty($x['isAdmin']) && !empty($x['active'])));
    if ($rec && !empty($rec['isAdmin']) && (empty($out['isAdmin']) || empty($out['active'])) && $admins < 2) jerr('يجب بقاء مدير واحد على الأقل');
    if ($pw !== '') $out['hash'] = password_hash($pw, PASSWORD_DEFAULT);
  } else {
    $nm = trim((string)($out['name'] ?? $out['date'] ?? $out['category'] ?? $out['type'] ?? '')); if ($nm === '') jerr('بيانات ناقصة');
    if (isset(AUTO[$e])) { if ($rec) $out[AUTO[$e]] = $rec[AUTO[$e]] ?? 0; else $out[AUTO[$e]] = nextCounter($db, $e, AUTO[$e]); }
  }
  if ($rec) { $rec = array_merge($rec, $out, ['updatedAt' => gmdate('c')]); }
  else { $rec = array_merge(['id' => rid(), 'createdAt' => gmdate('c')], $out); if ($e === 'visits' || $e === 'expenses') $rec['registeredBy'] = $me['username']; }
  putRec($db, $e, $rec);
  return ['record' => $e === 'users' ? pub($rec) : $rec];
}
