<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Bootstrap the application
(require __DIR__.'/../bootstrap/app.php')
    ->handleRequest(Request::capture());
