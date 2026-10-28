<?php
require_once __DIR__ . '/config.php';

function page_header(string $title): void {
    $u = user();
    $center = setting('center_name', 'المركز الطبي');
    $cur = basename($_SERVER['SCRIPT_NAME']);
    ?><!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($title) ?> - <?= e($center) ?></title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<?php if ($u): ?>
<div class="layout">
  <aside class="side">
    <div class="brand">
      <?php if (setting('logo')): ?><img src="file.php?f=<?= e(setting('logo')) ?>" alt=""><?php endif; ?>
      <b><?= e($center) ?></b>
    </div>
    <nav>
      <a href="index.php" class="<?= $cur === 'index.php' ? 'on' : '' ?>">🏠 الرئيسية</a>
      <?php foreach (SCREENS as $k => [$label, $file]): if (can($k)): ?>
        <a href="<?= e($file) ?>" class="<?= $cur === $file ? 'on' : '' ?>"><?= e($label) ?></a>
      <?php endif; endforeach; ?>
      <?php $anyRep = array_filter(array_keys(REPORTS), 'can'); if ($anyRep): ?>
        <div class="navh">التقارير</div>
        <?php foreach (REPORTS as $k => $label): if (can($k)): ?>
          <a href="reports.php?r=<?= e($k) ?>" class="<?= ($cur === 'reports.php' && ($_GET['r'] ?? '') === $k) ? 'on' : '' ?>"><?= e($label) ?></a>
        <?php endif; endforeach; ?>
      <?php endif; ?>
    </nav>
    <div class="who">👤 <?= e($u['username']) ?> <a href="logout.php">خروج</a></div>
  </aside>
  <main class="main">
    <div class="topbar"><h1><?= e($title) ?></h1><span class="muted" id="topclock"></span></div>
    <?php if (!empty($_SESSION['weak']) && $u['is_admin']): ?>
      <div class="alert warn">⚠️ كلمة المرور الحالية للمدير هي الافتراضية. غيّرها الآن من شاشة المستخدمين.</div>
    <?php endif; ?>
    <?php foreach (flashes() as [$t, $m]): ?><div class="alert <?= $t === 'ok' ? 'ok' : 'err' ?>"><?= e($m) ?></div><?php endforeach; ?>
<?php else: ?>
<div class="plain">
<?php endif;
}

function page_footer(): void {
    if (user()) echo "  </main>\n</div>\n"; else echo "</div>\n";
    echo '<script src="assets/app.js"></script></body></html>';
}
