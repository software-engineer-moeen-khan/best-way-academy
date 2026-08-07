<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Aliases for route middleware (easy to customize)
        $middleware->alias([
            'admin' => \App\Http\Middleware\IsAdmin::class,
            'instructor' => \App\Http\Middleware\IsInstructor::class,
        ]);

        // Append auth-aware middleware (sessions, csrf, etc. are on by default)
        $middleware->appendToGroup('web', [
            // Add any custom web middleware here
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
