<?php
require_once __DIR__ . '/layout.php';
require_perm('settings', 'view');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    require_perm('settings', 'edit');
    try {
        $name = trim((string)($_POST['center_name'] ?? ''));
        if ($name === '') throw new RuntimeException('اسم المركز مطلوب.');
        set_setting('center_name', mb_substr($name, 0, 100));
        set_setting('center_phone', mb_substr(trim((string)($_POST['center_phone'] ?? '')), 0, 50));
        set_setting('center_address', mb_substr(trim((string)($_POST['center_address'] ?? '')), 0, 200));
        set_setting('allow_register', !empty($_POST['allow_register']) ? '1' : '0');
        if ($logo = save_upload('logo')) { delete_upload(setting('logo') ?: null); set_setting('logo', $logo); }
        flash('تم حفظ الإعدادات.');
    } catch (RuntimeException $ex) { flash($ex->getMessage(), 'err'); }
    redirect('settings.php');
}
page_header('إعدادات المركز');
?>
<form method="post" enctype="multipart/form-data" class="card form"><?= csrf_field() ?>
  <div class="grid">
    <div class="field"><label>اسم المركز <i>*</i></label><input name="center_name" required value="<?= e(setting('center_name', 'المركز الطبي')) ?>"></div>
    <div class="field"><label>الهاتف</label><input name="center_phone" value="<?= e(setting('center_phone')) ?>"></div>
    <div class="field"><label>العنوان</label><input name="center_address" value="<?= e(setting('center_address')) ?>"></div>
    <div class="field"><label>لوجو المركز (يظهر في شاشة الدخول)</label><input type="file" name="logo" accept="image/jpeg,image/png,image/webp">
      <?php if (setting('logo')): ?><div class="cur"><?= img_tag(setting('logo'), 70) ?></div><?php endif; ?></div>
    <div class="field"><label><input type="checkbox" name="allow_register" value="1" style="width:auto" <?= setting('allow_register', '1') === '1' ? 'checked' : '' ?>> السماح بطلب "مستخدم جديد" من شاشة الدخول</label></div>
  </div>
  <div class="actions"><button class="btn pri">💾 حفظ</button></div>
</form>
<?php page_footer();
