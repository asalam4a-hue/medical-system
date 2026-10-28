<?php
require_once __DIR__ . '/crud.php';
crud([
    'table' => 'staff', 'title' => 'العاملين', 'singular' => 'موظف', 'perm' => 'staff',
    'search' => ['t.code', 't.name', 't.national_id'],
    'fields' => [
        ['name' => 'code', 'label' => 'كود الموظف', 'type' => 'code', 'prefix' => 'EMP-'],
        ['name' => 'name', 'label' => 'الاسم', 'required' => true],
        ['name' => 'national_id', 'label' => 'الرقم القومي', 'type' => 'nid', 'required' => true],
        ['name' => 'id_photo', 'label' => 'صورة الرقم القومي', 'type' => 'image'],
        ['name' => 'photo', 'label' => 'الصورة الشخصية', 'type' => 'image'],
    ],
    'cols' => [
        ['label' => 'الكود', 'key' => 'code'],
        ['label' => 'الاسم', 'key' => 'name'],
        ['label' => 'الرقم القومي', 'key' => 'national_id'],
        ['label' => 'صورة الرقم القومي', 'key' => 'id_photo', 'type' => 'img'],
        ['label' => 'الصورة الشخصية', 'key' => 'photo', 'type' => 'img'],
    ],
]);
