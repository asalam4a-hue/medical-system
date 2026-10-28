<?php
require_once __DIR__ . '/crud.php';
crud([
    'table' => 'operations', 'title' => 'العمليات', 'singular' => 'عملية', 'perm' => 'operations',
    'search' => ['t.name', 't.notes'],
    'fields' => [
        ['name' => 'name', 'label' => 'اسم العملية', 'required' => true],
        ['name' => 'price', 'label' => 'القيمة', 'type' => 'number', 'required' => true],
        ['name' => 'notes', 'label' => 'ملاحظات', 'type' => 'textarea'],
    ],
    'cols' => [
        ['label' => 'العملية', 'key' => 'name'],
        ['label' => 'القيمة', 'key' => 'price', 'type' => 'money'],
        ['label' => 'ملاحظات', 'key' => 'notes'],
    ],
]);
