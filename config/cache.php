<?php

use Illuminate\Support\Str;

return [
    'default'=>env('CACHE_STORE','file'),
    'stores'=>[
        'database'=>[
            'driver'=>'database',
            'connection'=>env('CACHE_DB_CONNECTION'),
            'table'=>env('CACHE_DB_TABLE','cache'),
            'lock_connection'=>env('CACHE_DB_LOCK_CONNECTION'),
            'lock_table'=>env('CACHE_DB_LOCK_TABLE','cache_locks'),
        ],
        'file'=>[
            'driver'=>'file',
            'path'=>storage_path('framework/cache/data'),
            'lock_path'=>storage_path('framework/cache/data'),
        ],
        'array'=>[
            'driver'=>'array',
            'serialize'=>false,
        ],
    ],
    'prefix'=>env('CACHE_PREFIX',Str::slug((string)env('APP_NAME','laravel')).'-cache-'),
];
