<?php
require_once __DIR__ . '/layout.php';

/* خيارات الحقل: options ثابتة أو sql يرجع (id, label, [extra]) */
function field_options(array $f): array {
    if (isset($f['options'])) {
        $o = [];
        foreach ($f['options'] as $k => $v) $o[(string)$k] = ['label' => $v, 'x' => null];
        return $o;
    }
    $o = [];
    foreach (db()->query($f['sql'])->fetchAll(PDO::FETCH_NUM) as $r) $o[(string)$r[0]] = ['label' => $r[1], 'x' => $r[2] ?? null];
    return $o;
}

function field_visible(array $f, array $src): bool {
    if (empty($f['showif'])) return true;
    return (string)($src[$f['showif'][0]] ?? '') === (string)$f['showif'][1];
}

function crud(array $cfg): void {
    $t = $cfg['table']; $perm = $cfg['perm']; $fields = $cfg['fields']; $pdo = db();
    require_perm($perm, 'view');

    $form = null; $formId = 0;

    /* ---------- معالجة POST ---------- */
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        csrf_check();
        $act = $_POST['act'] ?? '';
        $eid = (int)($_POST['id'] ?? 0);

        if ($act === 'delete') {
            require_perm($perm, 'delete');
            $st = $pdo->prepare("SELECT * FROM $t WHERE id=?"); $st->execute([$eid]); $old = $st->fetch();
            if ($old) {
                try {
                    $pdo->prepare("DELETE FROM $t WHERE id=?")->execute([$eid]);
                    foreach ($fields as $f) if (($f['type'] ?? '') === 'image') delete_upload($old[$f['name']] ?? null);
                    flash('تم الحذف.');
                } catch (PDOException $ex) {
                    flash('لا يمكن الحذف لأن هذا السجل مرتبط ببيانات أخرى (مثل الزيارات).', 'err');
                }
            }
            redirect(basename($_SERVER['SCRIPT_NAME']));
        }

        if ($act === 'save') {
            require_perm($perm, $eid ? 'edit' : 'add');
            $old = [];
            if ($eid) { $st = $pdo->prepare("SELECT * FROM $t WHERE id=?"); $st->execute([$eid]); $old = $st->fetch() ?: []; if (!$old) redirect(basename($_SERVER['SCRIPT_NAME'])); }
            $data = []; $errors = []; $newFiles = [];
            foreach ($fields as $f) {
                $n = $f['name']; $type = $f['type'] ?? 'text';
                if (in_array($type, ['code', 'readonly'], true)) continue;
                $visible = field_visible($f, $_POST);
                if ($type === 'image') {
                    if (!$visible) continue;
                    try {
                        $up = save_upload($n);
                        if ($up) { $data[$n] = $up; $newFiles[] = $up; }
                        elseif (!empty($f['required']) && empty($old[$n])) $errors[] = "{$f['label']} مطلوبة.";
                    } catch (RuntimeException $ex) { $errors[] = "{$f['label']}: " . $ex->getMessage(); }
                    continue;
                }
                if (!$visible) { $data[$n] = null; continue; }
                $v = trim((string)($_POST[$n] ?? ''));
                if (in_array($type, ['number', 'date', 'nid'], true)) $v = ar2en($v);
                if ($v === '') {
                    if (!empty($f['required'])) $errors[] = "{$f['label']} مطلوب.";
                    $data[$n] = ($type === 'number' && isset($f['default'])) ? $f['default'] : null;
                    continue;
                }
                switch ($type) {
                    case 'number':
                        if (!is_numeric($v) || (float)$v < 0) { $errors[] = "{$f['label']} يجب أن يكون رقماً صحيحاً."; break; }
                        if (isset($f['max']) && (float)$v > $f['max']) { $errors[] = "{$f['label']} يجب ألا يزيد عن {$f['max']}."; break; }
                        $data[$n] = (float)$v; break;
                    case 'date':
                        $d = DateTime::createFromFormat('Y-m-d', $v);
                        if (!$d || $d->format('Y-m-d') !== $v) { $errors[] = "{$f['label']} تاريخ غير صحيح."; break; }
                        $data[$n] = $v; break;
                    case 'nid':
                        if (!preg_match('/^\d{14}$/', $v)) { $errors[] = "{$f['label']} يجب أن يكون 14 رقماً."; break; }
                        $data[$n] = $v; break;
                    case 'select':
                        if (!array_key_exists($v, field_options($f))) { $errors[] = "{$f['label']}: اختيار غير صحيح."; break; }
                        $data[$n] = $v; break;
                    default:
                        $data[$n] = mb_substr($v, 0, 500);
                }
            }
            if (!$errors && isset($cfg['validate'])) $errors = array_merge($errors, ($cfg['validate'])($data, $eid));
            if ($errors) {
                foreach ($newFiles as $nf) delete_upload($nf);
                foreach ($errors as $er) flash($er, 'err');
                $form = $_POST; $formId = $eid;
            } else {
                if (isset($cfg['before_save'])) ($cfg['before_save'])($data, $eid);
                if ($eid) {
                    $sets = implode(',', array_map(fn($k) => "$k=:$k", array_keys($data)));
                    $pdo->prepare("UPDATE $t SET $sets WHERE id=:__id")->execute($data + ['__id' => $eid]);
                    foreach ($fields as $f) if (($f['type'] ?? '') === 'image' && isset($data[$f['name']]) && !empty($old[$f['name']])) delete_upload($old[$f['name']]);
                } else {
                    $cols = implode(',', array_keys($data)); $ph = implode(',', array_map(fn($k) => ":$k", array_keys($data)));
                    $pdo->prepare("INSERT INTO $t($cols) VALUES($ph)")->execute($data);
                    $eid = (int)$pdo->lastInsertId();
                    foreach ($fields as $f) if (($f['type'] ?? '') === 'code')
                        $pdo->prepare("UPDATE $t SET {$f['name']}=? WHERE id=?")->execute([$f['prefix'] . str_pad((string)$eid, 4, '0', STR_PAD_LEFT), $eid]);
                }
                flash('تم الحفظ بنجاح.');
                redirect(basename($_SERVER['SCRIPT_NAME']));
            }
        }
    }

    /* ---------- نموذج الإضافة/التعديل ---------- */
    $a = $_GET['a'] ?? 'list';
    if ($form !== null || $a === 'new' || $a === 'edit') {
        if ($form === null) {
            $formId = (int)($_GET['id'] ?? 0);
            if ($a === 'new') { require_perm($perm, 'add'); $form = []; foreach ($fields as $f) if (isset($f['default'])) $form[$f['name']] = $f['default']; }
            else {
                require_perm($perm, 'edit');
                $st = $pdo->prepare("SELECT * FROM $t WHERE id=?"); $st->execute([$formId]); $form = $st->fetch();
                if (!$form) redirect(basename($_SERVER['SCRIPT_NAME']));
            }
        } elseif ($formId) { // إعادة عرض بعد خطأ: نحتفظ بالصور الحالية
            $st = $pdo->prepare("SELECT * FROM $t WHERE id=?"); $st->execute([$formId]); $form = ($st->fetch() ?: []) + $form;
        }
        page_header(($formId ? 'تعديل ' : 'إضافة ') . $cfg['singular']);
        echo '<form method="post" enctype="multipart/form-data" class="card form" autocomplete="off">' . csrf_field();
        echo '<input type="hidden" name="act" value="save"><input type="hidden" name="id" value="' . (int)$formId . '">';
        echo '<div class="grid">';
        foreach ($fields as $f) {
            $n = $f['name']; $type = $f['type'] ?? 'text'; $val = $form[$n] ?? '';
            $attr = empty($f['showif']) ? '' : ' data-showif="' . e($f['showif'][0] . ':' . $f['showif'][1]) . '"';
            $req = !empty($f['required']) ? ' required' : '';
            echo '<div class="field' . ($type === 'textarea' ? ' wide' : '') . '"' . $attr . '><label for="f_' . e($n) . '">' . e($f['label']) . (!empty($f['required']) ? ' <i>*</i>' : '') . '</label>';
            switch ($type) {
                case 'code':
                    echo '<input id="f_' . e($n) . '" value="' . e($val ?: 'يتم إنشاؤه تلقائياً') . '" readonly>'; break;
                case 'readonly':
                    if (isset($f['calc']) && $formId) $val = ($f['calc'])($form);
                    if (isset($f['map'])) $val = $f['map'][$val] ?? $val;
                    echo '<input id="f_' . e($n) . '" value="' . e($val !== '' ? $val : '—') . '" readonly>'; break;
                case 'textarea':
                    echo '<textarea id="f_' . e($n) . '" name="' . e($n) . '" rows="3">' . e($val) . '</textarea>'; break;
                case 'number':
                    echo '<input id="f_' . e($n) . '" type="text" inputmode="decimal" name="' . e($n) . '" value="' . e($val) . '"' . $req . '>'; break;
                case 'date':
                    echo '<input id="f_' . e($n) . '" type="date" name="' . e($n) . '" value="' . e($val) . '"' . $req . '>'; break;
                case 'nid':
                    echo '<input id="f_' . e($n) . '" name="' . e($n) . '" value="' . e($val) . '" maxlength="14" inputmode="numeric" pattern="[0-9٠-٩]{14}" title="14 رقماً"' . $req . '>'; break;
                case 'image':
                    echo '<input id="f_' . e($n) . '" type="file" name="' . e($n) . '" accept="image/jpeg,image/png,image/webp"' . (!empty($f['required']) && empty($val) ? ' required' : '') . '>';
                    if (!empty($val)) echo '<div class="cur">الصورة الحالية: ' . img_tag($val, 60) . '</div>';
                    break;
                case 'select':
                    echo '<select id="f_' . e($n) . '" name="' . e($n) . '"' . $req . '><option value="">— اختر —</option>';
                    foreach (field_options($f) as $k => $o)
                        echo '<option value="' . e($k) . '"' . ((string)$val === (string)$k ? ' selected' : '') . ($o['x'] !== null ? ' data-x="' . e($o['x']) . '"' : '') . '>' . e($o['label']) . '</option>';
                    echo '</select>'; break;
                default:
                    $dl = '';
                    if (isset($f['suggest'])) {
                        $dl = ' list="dl_' . e($n) . '"';
                        echo '<datalist id="dl_' . e($n) . '">';
                        foreach ($pdo->query($f['suggest'])->fetchAll(PDO::FETCH_COLUMN) as $s) echo '<option value="' . e($s) . '">';
                        echo '</datalist>';
                    }
                    echo '<input id="f_' . e($n) . '" name="' . e($n) . '" value="' . e($val) . '"' . $dl . $req . '>';
            }
            echo '</div>';
        }
        echo '</div><div class="actions"><button class="btn pri">💾 حفظ</button> <a class="btn" href="' . e(basename($_SERVER['SCRIPT_NAME'])) . '">رجوع</a></div></form>';
        if (!empty($cfg['script'])) echo '<script>' . $cfg['script'] . '</script>';
        page_footer();
        return;
    }

    /* ---------- القائمة ---------- */
    $q = trim((string)($_GET['q'] ?? '')); $from = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
    $where = []; $par = [];
    if ($q !== '' && !empty($cfg['search'])) {
        $parts = [];
        foreach ($cfg['search'] as $i => $c) { $parts[] = "$c LIKE :q$i"; $par["q$i"] = "%$q%"; }
        $where[] = '(' . implode(' OR ', $parts) . ')';
    }
    if (!empty($cfg['date_col'])) {
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) { $where[] = $cfg['date_col'] . ' >= :df'; $par['df'] = $from; }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $to))   { $where[] = $cfg['date_col'] . ' <= :dt'; $par['dt'] = $to; }
    }
    $fromSql = $cfg['from'] ?? "$t t";
    $wsql = $where ? ' WHERE ' . implode(' AND ', $where) : '';
    $cnt = $pdo->prepare("SELECT COUNT(*) FROM $fromSql$wsql"); $cnt->execute($par); $total = (int)$cnt->fetchColumn();
    $per = 50; $pages = max(1, (int)ceil($total / $per)); $pg = min($pages, max(1, (int)($_GET['p'] ?? 1)));
    $st = $pdo->prepare('SELECT ' . ($cfg['select'] ?? 't.*') . " FROM $fromSql$wsql ORDER BY " . ($cfg['order'] ?? 't.id DESC') . " LIMIT $per OFFSET " . (($pg - 1) * $per));
    $st->execute($par); $rows = $st->fetchAll();
    $sums = [];
    foreach (($cfg['sum'] ?? []) as $label => $col) { $s = $pdo->prepare("SELECT COALESCE(SUM($col),0) FROM $fromSql$wsql"); $s->execute($par); $sums[$label] = (float)$s->fetchColumn(); }

    page_header($cfg['title']);
    echo '<div class="toolbar no-print"><form method="get" class="inline">';
    if (!empty($cfg['search'])) echo '<input name="q" placeholder="بحث..." value="' . e($q) . '">';
    if (!empty($cfg['date_col'])) echo '<label>من <input type="date" name="from" value="' . e($from) . '"></label><label>إلى <input type="date" name="to" value="' . e($to) . '"></label>';
    echo '<button class="btn">بحث</button></form><span class="sp"></span>';
    if (can($perm, 'add')) echo '<a class="btn pri" href="?a=new">➕ إضافة ' . e($cfg['singular']) . '</a>';
    echo '<button class="btn" onclick="window.print()">🖨️ طباعة</button></div>';
    echo '<div class="card"><div class="tw"><table class="tbl"><thead><tr><th>#</th>';
    foreach ($cfg['cols'] as $c) echo '<th>' . e($c['label']) . '</th>';
    echo '<th class="no-print">إجراءات</th></tr></thead><tbody>';
    if (!$rows) echo '<tr><td colspan="' . (count($cfg['cols']) + 2) . '" class="muted c">لا توجد بيانات.</td></tr>';
    foreach ($rows as $i => $r) {
        echo '<tr><td>' . (($pg - 1) * $per + $i + 1) . '</td>';
        foreach ($cfg['cols'] as $c) {
            $v = isset($c['fn']) ? ($c['fn'])($r) : ($r[$c['key']] ?? '');
            switch ($c['type'] ?? 'text') {
                case 'img':   echo '<td>' . img_tag($v) . '</td>'; break;
                case 'money': echo '<td class="num">' . money($v) . '</td>'; break;
                case 'html':  echo '<td>' . $v . '</td>'; break;
                default:      echo '<td>' . ($v === null || $v === '' ? '<span class="muted">—</span>' : e($v)) . '</td>';
            }
        }
        echo '<td class="no-print acts">';
        if (can($perm, 'edit')) echo '<a class="btn sm" href="?a=edit&id=' . (int)$r['id'] . '">تعديل</a> ';
        if (can($perm, 'delete')) echo '<form method="post" class="inline" onsubmit="return confirm(\'تأكيد الحذف؟\')">' . csrf_field() . '<input type="hidden" name="act" value="delete"><input type="hidden" name="id" value="' . (int)$r['id'] . '"><button class="btn sm danger">حذف</button></form>';
        echo '</td></tr>';
    }
    echo '</tbody></table></div>';
    if ($sums) { echo '<div class="sums">'; foreach ($sums as $l => $v) echo '<span>' . e($l) . ': <b>' . money($v) . '</b></span>'; echo '</div>'; }
    echo '<div class="pager no-print">إجمالي السجلات: ' . $total;
    if ($pages > 1) for ($i = 1; $i <= $pages; $i++) echo ' <a class="pg' . ($i === $pg ? ' on' : '') . '" href="?' . e(http_build_query(['q' => $q, 'from' => $from, 'to' => $to, 'p' => $i])) . '">' . $i . '</a>';
    echo '</div></div>';
    page_footer();
}
