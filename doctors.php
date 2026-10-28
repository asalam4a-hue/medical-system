<?php
require_once __DIR__ . '/crud.php';
crud([
    'table' => 'doctors', 'title' => 'الأطباء', 'singular' => 'طبيب', 'perm' => 'doctors',
    'search' => ['t.code', 't.name', 't.clinic', 't.id_number'],
    'fields' => [
        ['name' => 'code', 'label' => 'كود الطبيب', 'type' => 'code', 'prefix' => 'DR-'],
        ['name' => 'name', 'label' => 'اسم الطبيب', 'required' => true],
        ['name' => 'clinic', 'label' => 'العيادة', 'suggest' => "SELECT name FROM services WHERE type='clinic' ORDER BY name"],
        ['name' => 'id_number', 'label' => 'رقم البطاقة', 'type' => 'nid', 'required' => true],
        ['name' => 'id_photo', 'label' => 'صورة البطاقة', 'type' => 'image'],
        ['name' => 'syndicate_photo', 'label' => 'صورة الكارنية', 'type' => 'image'],
        ['name' => 'photo', 'label' => 'الصورة الشخصية', 'type' => 'image'],
        ['name' => 'hire_date', 'label' => 'تاريخ التعيين', 'type' => 'date'],
        ['name' => 'percentage', 'label' => 'نسبة الطبيب %', 'type' => 'number', 'max' => 100, 'default' => 0],
        ['name' => 'fixed_amount', 'label' => 'الفكسيد (المبلغ الثابت)', 'type' => 'number', 'default' => 0],
        ['name' => 'due', 'label' => 'آخر أجر مستحق (الشهر الحالي - تلقائي)', 'type' => 'readonly',
         'calc' => fn($r) => money(doctor_due($r)['due'])],
    ],
    'cols' => [
        ['label' => 'الكود', 'key' => 'code'],
        ['label' => 'الطبيب', 'key' => 'name'],
        ['label' => 'العيادة', 'key' => 'clinic'],
        ['label' => 'رقم البطاقة', 'key' => 'id_number'],
        ['label' => 'البطاقة', 'key' => 'id_photo', 'type' => 'img'],
        ['label' => 'الكارنية', 'key' => 'syndicate_photo', 'type' => 'img'],
        ['label' => 'الصورة', 'key' => 'photo', 'type' => 'img'],
        ['label' => 'تاريخ التعيين', 'key' => 'hire_date'],
        ['label' => 'النسبة %', 'key' => 'percentage'],
        ['label' => 'الفكسيد', 'key' => 'fixed_amount', 'type' => 'money'],
        ['label' => 'آخر أجر مستحق', 'type' => 'money', 'fn' => fn($r) => doctor_due($r)['due']],
    ],
]);
