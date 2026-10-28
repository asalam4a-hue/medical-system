<?php
require_once __DIR__ . '/crud.php';
crud([
    'table' => 'insurers', 'title' => 'شركات التأمين', 'singular' => 'شركة تأمين', 'perm' => 'insurers',
    'search' => ['t.name'],
    'fields' => [
        ['name' => 'name', 'label' => 'اسم الشركة', 'required' => true],
        ['name' => 'exam_fee', 'label' => 'قيمة الكشف', 'type' => 'number', 'required' => true],
    ],
    'cols' => [
        ['label' => 'اسم الشركة', 'key' => 'name'],
        ['label' => 'قيمة الكشف', 'key' => 'exam_fee', 'type' => 'money'],
    ],
]);
