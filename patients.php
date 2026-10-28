<?php
require_once __DIR__ . '/crud.php';
crud([
    'table' => 'patients', 'title' => 'المرضى', 'singular' => 'مريض', 'perm' => 'patients',
    'search' => ['t.name', 't.phone'],
    'fields' => [
        ['name' => 'name', 'label' => 'اسم المريض', 'required' => true],
        ['name' => 'phone', 'label' => 'رقم الهاتف'],
    ],
    'cols' => [
        ['label' => 'اسم المريض', 'key' => 'name'],
        ['label' => 'رقم الهاتف', 'key' => 'phone'],
    ],
]);
