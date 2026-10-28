<?php
require_once __DIR__ . '/layout.php';
require_perm('users', 'view');
$pdo = db(); $me = user(); $self = basename($_SERVER['SCRIPT_NAME']);
$form = null; $formId = 0;

function admins_left(PDO $pdo, int $excl): int {
    $s = $pdo->prepare('SELECT COUNT(*) FROM users WHERE is_admin=1 AND is_active=1 AND id<>?'); $s->execute([$excl]);
    return (int)$s->fetchColumn();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $act = $_POST['act'] ?? ''; $id = (int)($_POST['id'] ?? 0);

    if ($act === 'delete') {
        require_perm('users', 'delete');
        if ($id === (int)$me['id']) flash('لا يمكنك حذف حسابك الحالي.', 'err');
        elseif (admins_left($pdo, $id) < 1 && $pdo->query("SELECT is_admin FROM users WHERE id=$id")->fetchColumn()) flash('لا يمكن حذف آخر مدير للنظام.', 'err');
        else { $pdo->prepare('DELETE FROM users WHERE id=?')->execute([$id]); flash('تم حذف المستخدم.'); }
        redirect($self);
    }

    if ($act === 'save') {
        require_perm('users', $id ? 'edit' : 'add');
        $un = trim($_POST['username'] ?? ''); $pw = (string)($_POST['password'] ?? '');
        $nid = ar2en(trim($_POST['national_id'] ?? '')); $bd = ar2en(trim($_POST['birth_date'] ?? ''));
        $isAdmin = !empty($_POST['is_admin']) ? 1 : 0; $active = !empty($_POST['is_active']) ? 1 : 0;
        $valid = array_merge(array_keys(REPORTS), array_merge(...array_map(fn($k) => array_map(fn($a) => "$k.$a", array_keys(ACTIONS)), array_keys(SCREENS))));
        $perms = array_values(array_intersect((array)($_POST['perm'] ?? []), $valid));
        $err = [];
        if (!preg_match('/^[\p{L}\p{N}_.-]{3,30}$/u', $un)) $err[] = 'اسم المستخدم من 3 إلى 30 حرفاً بدون مسافات.';
        if (!$id && strlen($pw) < 6) $err[] = 'كلمة المرور 6 أحرف على الأقل.';
        if ($id && $pw !== '' && strlen($pw) < 6) $err[] = 'كلمة المرور الجديدة 6 أحرف على الأقل.';
        if (!preg_match('/^\d{14}$/', $nid)) $err[] = 'الرقم القومي يجب أن يكون 14 رقماً.';
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $bd)) $err[] = 'تاريخ الميلاد غير صحيح.';
        if ($id === (int)$me['id'] && (!$isAdmin || !$active)) $err[] = 'لا يمكنك إلغاء صلاحية المدير أو تعطيل حسابك الحالي.';
        if (!$err) {
            try {
                if ($id) {
                    $sql = 'UPDATE users SET username=?, national_id=?, birth_date=?, is_admin=?, is_active=?, perms=?' . ($pw !== '' ? ', password=?' : '') . ' WHERE id=?';
                    $args = [$un, $nid, $bd, $isAdmin, $active, json_encode($perms), ...($pw !== '' ? [password_hash($pw, PASSWORD_DEFAULT)] : []), $id];
                    $pdo->prepare($sql)->execute($args);
                } else {
                    $pdo->prepare('INSERT INTO users(username,password,national_id,birth_date,is_admin,is_active,perms) VALUES(?,?,?,?,?,?,?)')
                        ->execute([$un, password_hash($pw, PASSWORD_DEFAULT), $nid, $bd, $isAdmin, $active, json_encode($perms)]);
                }
                if ($id === (int)$me['id'] && $pw !== '') unset($_SESSION['weak']);
                flash('تم حفظ المستخدم.');
                redirect($self);
            } catch (PDOException $ex) { $err[] = 'اسم المستخدم مستخدم من قبل.'; }
        }
        foreach ($err as $x) flash($x, 'err');
        $form = $_POST; $form['perm_list'] = $perms; $formId = $id;
    }
}

$a = $_GET['a'] ?? 'list';
if ($form !== null || $a === 'new' || $a === 'edit') {
    if ($form === null) {
        $formId = (int)($_GET['id'] ?? 0);
        if ($a === 'new') { require_perm('users', 'add'); $form = ['is_active' => 1, 'perm_list' => []]; }
        else {
            require_perm('users', 'edit');
            $st = $pdo->prepare('SELECT * FROM users WHERE id=?'); $st->execute([$formId]); $form = $st->fetch();
            if (!$form) redirect($self);
            $form['perm_list'] = json_decode($form['perms'] ?: '[]', true) ?: [];
        }
    }
    $has = fn($k) => in_array($k, $form['perm_list'] ?? [], true) ? ' checked' : '';
    page_header($formId ? 'تعديل مستخدم' : 'مستخدم جديد');
    ?>
    <form method="post" class="card form" autocomplete="off"><?= csrf_field() ?>
      <input type="hidden" name="act" value="save"><input type="hidden" name="id" value="<?= (int)$formId ?>">
      <div class="grid">
        <div class="field"><label>اسم المستخدم <i>*</i></label><input name="username" required value="<?= e($form['username'] ?? '') ?>"></div>
        <div class="field"><label>كلمة المرور <?= $formId ? '(اتركها فارغة بدون تغيير)' : '<i>*</i>' ?></label><input type="password" name="password" autocomplete="new-password" <?= $formId ? '' : 'required' ?>></div>
        <div class="field"><label>الرقم القومي <i>*</i></label><input id="f_national_id" name="national_id" maxlength="14" inputmode="numeric" required value="<?= e($form['national_id'] ?? '') ?>"></div>
        <div class="field"><label>تاريخ الميلاد <i>*</i></label><input id="f_birth_date" type="date" name="birth_date" required value="<?= e($form['birth_date'] ?? '') ?>"></div>
        <div class="field"><label><input type="checkbox" name="is_active" value="1" style="width:auto" <?= !empty($form['is_active']) ? 'checked' : '' ?>> الحساب مفعّل</label></div>
        <div class="field"><label><input type="checkbox" name="is_admin" value="1" style="width:auto" <?= !empty($form['is_admin']) ? 'checked' : '' ?>> مدير النظام (كل الصلاحيات)</label></div>
      </div>
      <h3>صلاحيات الشاشات</h3>
      <div class="tw"><table class="perm"><thead><tr><th>الشاشة</th><?php foreach (ACTIONS as $al): ?><th><?= e($al) ?></th><?php endforeach; ?></tr></thead><tbody>
        <?php foreach (SCREENS as $k => [$label]): ?>
          <tr><td><?= e($label) ?></td><?php foreach (ACTIONS as $ak => $al): ?><td><input type="checkbox" name="perm[]" value="<?= e("$k.$ak") ?>"<?= $has("$k.$ak") ?>></td><?php endforeach; ?></tr>
        <?php endforeach; ?>
      </tbody></table></div>
      <h3>صلاحيات التقارير</h3>
      <div class="tw"><table class="perm"><tbody>
        <?php foreach (REPORTS as $k => $label): ?>
          <tr><td><?= e($label) ?></td><td><input type="checkbox" name="perm[]" value="<?= e($k) ?>"<?= $has($k) ?>></td></tr>
        <?php endforeach; ?>
      </tbody></table></div>
      <div class="actions"><button class="btn pri">💾 حفظ</button> <a class="btn" href="<?= e($self) ?>">رجوع</a></div>
    </form>
    <?php
    page_footer();
    exit;
}

$rows = $pdo->query('SELECT * FROM users ORDER BY id')->fetchAll();
page_header('المستخدمين');
echo '<div class="toolbar no-print"><span class="sp"></span>';
if (can('users', 'add')) echo '<a class="btn pri" href="?a=new">➕ مستخدم جديد</a>';
echo '</div><div class="card"><div class="tw"><table class="tbl"><thead><tr><th>#</th><th>اسم المستخدم</th><th>الرقم القومي</th><th>تاريخ الميلاد</th><th>الدور</th><th>الحالة</th><th>عدد الصلاحيات</th><th>إجراءات</th></tr></thead><tbody>';
foreach ($rows as $i => $r) {
    $np = count(json_decode($r['perms'] ?: '[]', true) ?: []);
    echo '<tr><td>' . ($i + 1) . '</td><td>' . e($r['username']) . '</td><td>' . e($r['national_id']) . '</td><td>' . e($r['birth_date']) . '</td><td>' . ($r['is_admin'] ? 'مدير' : 'مستخدم') . '</td><td>' . ($r['is_active'] ? '✅ مفعّل' : '⏳ بانتظار التفعيل') . '</td><td>' . ($r['is_admin'] ? 'الكل' : $np) . '</td><td class="acts">';
    if (can('users', 'edit')) echo '<a class="btn sm" href="?a=edit&id=' . (int)$r['id'] . '">تعديل / صلاحيات</a> ';
    if (can('users', 'delete') && (int)$r['id'] !== (int)$me['id']) echo '<form method="post" class="inline" onsubmit="return confirm(\'حذف المستخدم؟\')">' . csrf_field() . '<input type="hidden" name="act" value="delete"><input type="hidden" name="id" value="' . (int)$r['id'] . '"><button class="btn sm danger">حذف</button></form>';
    echo '</td></tr>';
}
echo '</tbody></table></div></div>';
page_footer();
