<?php
require_once __DIR__ . '/layout.php';
if (user()) redirect('index.php');

$pdo = db();
$mode = ($_GET['m'] ?? '') === 'new' ? 'new' : 'login';
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$pdo->prepare('DELETE FROM login_attempts WHERE ts < ?')->execute([time() - 900]);
$cnt = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip=?'); $cnt->execute([$ip]);
$blocked = (int)$cnt->fetchColumn() >= 8;
$msg = ''; $msgType = 'err';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if ($blocked) {
        $msg = 'محاولات كثيرة خاطئة. حاول بعد 15 دقيقة.';
    } elseif (($_POST['act'] ?? '') === 'login') {
        $st = $pdo->prepare('SELECT * FROM users WHERE username=?'); $st->execute([trim($_POST['username'] ?? '')]);
        $u = $st->fetch();
        if ($u && password_verify($_POST['password'] ?? '', $u['password'])) {
            if (!$u['is_active']) { $msg = 'حسابك بانتظار التفعيل من مدير النظام.'; }
            else {
                session_regenerate_id(true);
                $_SESSION['uid'] = (int)$u['id'];
                $_SESSION['weak'] = password_verify('admin123', $u['password']);
                redirect('index.php');
            }
        } else {
            $pdo->prepare('INSERT INTO login_attempts(ip,ts) VALUES(?,?)')->execute([$ip, time()]);
            $msg = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
        }
    } elseif (($_POST['act'] ?? '') === 'register' && setting('allow_register', '1') === '1') {
        $mode = 'new';
        $un = trim($_POST['username'] ?? ''); $pw = $_POST['password'] ?? '';
        $nid = ar2en(trim($_POST['national_id'] ?? '')); $bd = ar2en(trim($_POST['birth_date'] ?? ''));
        if (!preg_match('/^[\p{L}\p{N}_.-]{3,30}$/u', $un)) $msg = 'اسم المستخدم من 3 إلى 30 حرفاً بدون مسافات.';
        elseif (strlen($pw) < 6) $msg = 'كلمة المرور 6 أحرف على الأقل.';
        elseif ($pw !== ($_POST['password2'] ?? '')) $msg = 'تأكيد كلمة المرور غير مطابق.';
        elseif (!preg_match('/^\d{14}$/', $nid)) $msg = 'الرقم القومي يجب أن يكون 14 رقماً.';
        elseif (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $bd)) $msg = 'تاريخ الميلاد غير صحيح.';
        else {
            try {
                $pdo->prepare('INSERT INTO users(username,password,national_id,birth_date,is_admin,is_active,perms) VALUES(?,?,?,?,0,0,?)')
                    ->execute([$un, password_hash($pw, PASSWORD_DEFAULT), $nid, $bd, '[]']);
                $msg = 'تم تسجيل الطلب. سيقوم مدير النظام بتفعيل حسابك ومنحك الصلاحيات.'; $msgType = 'ok'; $mode = 'login';
            } catch (PDOException $ex) { $msg = 'اسم المستخدم مستخدم من قبل.'; }
        }
    }
}

$center = setting('center_name', 'المركز الطبي');
page_header('تسجيل الدخول');
?>
<div class="login">
  <?php if (setting('logo')): ?><img class="logo" src="file.php?f=<?= e(setting('logo')) ?>" alt="logo"><?php else: ?><div style="font-size:60px">🏥</div><?php endif; ?>
  <h2><?= e($center) ?></h2>

  <svg class="clock" viewBox="0 0 200 200" id="aclock" aria-hidden="true">
    <circle cx="100" cy="100" r="96" fill="#fff" stroke="#0e7c86" stroke-width="6"/>
    <g id="ticks"></g>
    <line id="hh" x1="100" y1="100" x2="100" y2="55" stroke="#1d2b36" stroke-width="6" stroke-linecap="round"/>
    <line id="mh" x1="100" y1="100" x2="100" y2="35" stroke="#1d2b36" stroke-width="4" stroke-linecap="round"/>
    <line id="sh" x1="100" y1="112" x2="100" y2="28" stroke="#c0392b" stroke-width="2" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="6" fill="#0e7c86"/>
  </svg>
  <div class="digital" id="dclock">--:--:--</div>
  <div class="dateline" id="dline"></div>

  <?php if ($msg): ?><div class="alert <?= $msgType ?>"><?= e($msg) ?></div><?php endif; ?>

  <?php if ($mode === 'login'): ?>
  <form method="post" autocomplete="off"><?= csrf_field() ?><input type="hidden" name="act" value="login">
    <div class="field"><label>اسم المستخدم</label><input name="username" required autofocus></div>
    <div class="field"><label>كلمة المرور</label><input type="password" name="password" required></div>
    <button class="btn pri">دخول</button>
  </form>
  <?php if (setting('allow_register', '1') === '1'): ?><div class="sw"><a href="?m=new">➕ مستخدم جديد</a></div><?php endif; ?>
  <?php else: ?>
  <form method="post" autocomplete="off"><?= csrf_field() ?><input type="hidden" name="act" value="register">
    <div class="field"><label>اسم المستخدم</label><input name="username" required value="<?= e($_POST['username'] ?? '') ?>"></div>
    <div class="field"><label>كلمة المرور</label><input type="password" name="password" required></div>
    <div class="field"><label>تأكيد كلمة المرور</label><input type="password" name="password2" required></div>
    <div class="field"><label>الرقم القومي</label><input id="f_national_id" name="national_id" maxlength="14" inputmode="numeric" required value="<?= e($_POST['national_id'] ?? '') ?>"></div>
    <div class="field"><label>تاريخ الميلاد</label><input id="f_birth_date" type="date" name="birth_date" required value="<?= e($_POST['birth_date'] ?? '') ?>"></div>
    <button class="btn pri">تسجيل مستخدم جديد</button>
  </form>
  <div class="sw"><a href="login.php">← رجوع لتسجيل الدخول</a></div>
  <?php endif; ?>
</div>
<script>
(function(){
  var t=document.getElementById('ticks'),s='';
  for(var i=0;i<12;i++){s+='<line x1="100" y1="12" x2="100" y2="'+(i%3?20:24)+'" stroke="#0e7c86" stroke-width="'+(i%3?2:4)+'" transform="rotate('+i*30+' 100 100)"/>';}
  t.innerHTML=s;
  var days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  function p(n){return String(n).padStart(2,'0');}
  function tick(){
    var d=new Date(),h=d.getHours(),m=d.getMinutes(),sec=d.getSeconds();
    document.getElementById('hh').setAttribute('transform','rotate('+((h%12)*30+m/2)+' 100 100)');
    document.getElementById('mh').setAttribute('transform','rotate('+(m*6+sec/10)+' 100 100)');
    document.getElementById('sh').setAttribute('transform','rotate('+(sec*6)+' 100 100)');
    document.getElementById('dclock').textContent=p(h)+':'+p(m)+':'+p(sec);
    document.getElementById('dline').textContent=days[d.getDay()]+' — '+p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();
  }
  tick();setInterval(tick,1000);
})();
</script>
<?php page_footer();
