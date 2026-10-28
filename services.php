<?php
require_once __DIR__ . '/crud.php';
crud([
    'table' => 'services', 'title' => 'الخدمات (عيادات - أشعة - تحاليل)', 'singular' => 'خدمة', 'perm' => 'services',
    'search' => ['t.name'], 'order' => 't.type, t.name',
    'fields' => [
        ['name' => 'type', 'label' => 'نوع الخدمة', 'type' => 'select', 'options' => SERVICE_TYPES, 'required' => true],
        ['name' => 'name', 'label' => 'اسم الخدمة', 'required' => true],
        ['name' => 'price', 'label' => 'القيمة', 'type' => 'number', 'required' => true],
    ],
    'cols' => [
        ['label' => 'النوع', 'fn' => fn($r) => SERVICE_TYPES[$r['type']] ?? $r['type']],
        ['label' => 'الخدمة', 'key' => 'name'],
        ['label' => 'القيمة', 'key' => 'price', 'type' => 'money'],
    ],
]);
