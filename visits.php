<?php
require_once __DIR__ . '/crud.php';

$script = <<<'JS'
(function(){
  var $=function(id){return document.getElementById(id);};
  var date=$('f_visit_date'), day=$('f_day_name'), pat=$('f_patient_id'), svc=$('f_service_id'),
      val=$('f_value'), ins=$('f_insurer_id'), typ=$('f_visit_type'), ph=$('f_phone'),
      ld=$('f_last_visit_date'), lt=$('f_last_visit_type');
  var days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  function setDay(){ if(date&&date.value&&day){ var d=new Date(date.value+'T00:00:00'); day.value=days[d.getDay()]; } }
  if(date){ if(!date.value){ var n=new Date(); date.value=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0'); } setDay(); date.addEventListener('change',setDay); }
  var editId=parseInt(document.querySelector('input[name=id]').value||'0',10);
  if(pat) pat.addEventListener('change',function(){
    if(!pat.value){ return; }
    fetch('api.php?a=patient&id='+encodeURIComponent(pat.value)+'&skip='+editId).then(function(r){return r.json();}).then(function(j){
      if(ph && !ph.value) ph.value=j.phone||'';
      if(ld) ld.value=j.last_date||'لا توجد زيارة سابقة';
      if(lt) lt.value=j.last_type||'—';
    });
  });
  if(svc) svc.addEventListener('change',function(){ var o=svc.options[svc.selectedIndex]; if(o&&o.dataset.x&&val) val.value=o.dataset.x; });
  if(ins) ins.addEventListener('change',function(){ var o=ins.options[ins.selectedIndex]; if(o&&parseFloat(o.dataset.x)>0&&val) val.value=o.dataset.x; });
})();
JS;

crud([
    'table' => 'visits', 'title' => 'الزيارات', 'singular' => 'زيارة', 'perm' => 'visits', 'script' => $script,
    'select' => 't.*, p.name AS patient, s.name AS service, d.name AS doctor, i.name AS insurer',
    'from' => 'visits t JOIN patients p ON p.id=t.patient_id JOIN services s ON s.id=t.service_id LEFT JOIN doctors d ON d.id=t.doctor_id LEFT JOIN insurers i ON i.id=t.insurer_id',
    'search' => ['p.name', 'p.phone', 's.name', 'd.name', 'i.name', 't.form_no', 't.card_no'],
    'date_col' => 't.visit_date', 'order' => 't.visit_date DESC, t.id DESC',
    'sum' => ['إجمالي القيمة' => 't.value'],
    'fields' => [
        ['name' => 'visit_date', 'label' => 'تاريخ الزيارة', 'type' => 'date', 'required' => true, 'default' => date('Y-m-d')],
        ['name' => 'day_name', 'label' => 'اليوم (تلقائي)', 'type' => 'readonly', 'calc' => fn($r) => day_name($r['visit_date'] ?? '')],
        ['name' => 'patient_id', 'label' => 'اسم المريض', 'type' => 'select', 'required' => true,
         'sql' => 'SELECT id, name, phone FROM patients ORDER BY name'],
        ['name' => 'service_id', 'label' => 'الزيارة (الخدمة)', 'type' => 'select', 'required' => true,
         'sql' => "SELECT id, CASE type WHEN 'clinic' THEN 'عيادة' WHEN 'radiology' THEN 'أشعة' ELSE 'تحاليل' END || ' - ' || name, price FROM services ORDER BY type, name"],
        ['name' => 'value', 'label' => 'القيمة', 'type' => 'number', 'required' => true],
        ['name' => 'doctor_id', 'label' => 'الطبيب المعالج', 'type' => 'select', 'sql' => 'SELECT id, name FROM doctors ORDER BY name'],
        ['name' => 'visit_type', 'label' => 'نوع الزيارة', 'type' => 'select', 'options' => VISIT_TYPES, 'required' => true, 'default' => 'cash'],
        /* الحقول التالية تظهر عند اختيار "شركة" فقط */
        ['name' => 'insurer_id', 'label' => 'شركة التأمين', 'type' => 'select', 'required' => true, 'showif' => ['visit_type', 'company'],
         'sql' => 'SELECT id, name, exam_fee FROM insurers ORDER BY name'],
        ['name' => 'form_no', 'label' => 'رقم النموذج', 'showif' => ['visit_type', 'company']],
        ['name' => 'form_photo', 'label' => 'صورة النموذج', 'type' => 'image', 'showif' => ['visit_type', 'company']],
        ['name' => 'card_no', 'label' => 'رقم الكارنية', 'showif' => ['visit_type', 'company']],
        ['name' => 'card_photo', 'label' => 'صورة الكارنية', 'type' => 'image', 'showif' => ['visit_type', 'company']],
        ['name' => 'share_pct', 'label' => 'نسبة تحمل المريض %', 'type' => 'number', 'max' => 100, 'required' => true, 'showif' => ['visit_type', 'company']],
        ['name' => 'phone', 'label' => 'رقم التليفون', 'showif' => ['visit_type', 'company']],
        ['name' => 'last_visit_date', 'label' => 'آخر تاريخ زيارة (تلقائي)', 'type' => 'readonly', 'showif' => ['visit_type', 'company']],
        ['name' => 'last_visit_type', 'label' => 'نوع آخر زيارة (تلقائي)', 'type' => 'readonly', 'map' => VISIT_TYPES, 'showif' => ['visit_type', 'company']],
    ],
    'before_save' => function (array &$d, int $id) {
        $d['day_name'] = day_name($d['visit_date']);
        $st = db()->prepare('SELECT visit_date, visit_type FROM visits WHERE patient_id=? AND id<>? AND visit_date<=? ORDER BY visit_date DESC, id DESC LIMIT 1');
        $st->execute([$d['patient_id'], $id, $d['visit_date']]);
        $last = $st->fetch();
        $d['last_visit_date'] = $last['visit_date'] ?? null;
        $d['last_visit_type'] = $last['visit_type'] ?? null;
        if (!$id) $d['created_by'] = user()['id'];
        if ($d['visit_type'] === 'company' && empty($d['phone'])) {
            $p = db()->prepare('SELECT phone FROM patients WHERE id=?'); $p->execute([$d['patient_id']]);
            $d['phone'] = $p->fetchColumn() ?: null;
        }
    },
    'cols' => [
        ['label' => 'التاريخ', 'key' => 'visit_date'],
        ['label' => 'اليوم', 'key' => 'day_name'],
        ['label' => 'المريض', 'key' => 'patient'],
        ['label' => 'الزيارة', 'key' => 'service'],
        ['label' => 'الطبيب', 'key' => 'doctor'],
        ['label' => 'النوع', 'fn' => fn($r) => VISIT_TYPES[$r['visit_type']] ?? $r['visit_type']],
        ['label' => 'شركة التأمين', 'key' => 'insurer'],
        ['label' => 'رقم النموذج', 'key' => 'form_no'],
        ['label' => 'صورة النموذج', 'key' => 'form_photo', 'type' => 'img'],
        ['label' => 'رقم الكارنية', 'key' => 'card_no'],
        ['label' => 'صورة الكارنية', 'key' => 'card_photo', 'type' => 'img'],
        ['label' => 'تحمل المريض %', 'key' => 'share_pct'],
        ['label' => 'آخر زيارة', 'fn' => fn($r) => $r['visit_type'] === 'company' && $r['last_visit_date']
            ? $r['last_visit_date'] . ' (' . (VISIT_TYPES[$r['last_visit_type']] ?? '') . ')' : ''],
        ['label' => 'القيمة', 'key' => 'value', 'type' => 'money'],
    ],
]);
