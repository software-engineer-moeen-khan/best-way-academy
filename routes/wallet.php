<?php

use App\Http\Controllers\WalletController;
use Illuminate\Support\Facades\Route;

Route::get('/wallet', function () {
    $file = base_path('wallet.html');
    abort_unless(is_file($file), 404);

    return response(file_get_contents($file), 200, [
        'Content-Type' => 'text/html; charset=UTF-8',
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
        'Pragma' => 'no-cache',
        'Expires' => '0',
    ]);
});

Route::middleware('auth')->group(function () {
    Route::prefix('api/wallet')->middleware('throttle:60,1')->group(function () {
        Route::get('/', [WalletController::class, 'show']);
        Route::get('/deposit-qr', [WalletController::class, 'qr']);
        Route::post('/deposits', [WalletController::class, 'deposit'])->middleware('throttle:8,1');
        Route::post('/withdrawals', [WalletController::class, 'withdrawal'])->middleware('throttle:8,1');
        Route::delete('/withdrawals/{walletRequest}', [WalletController::class, 'cancelWithdrawal'])->whereNumber('walletRequest');
        Route::get('/requests/{walletRequest}/proof', [WalletController::class, 'proof'])->whereNumber('walletRequest');
    });

    Route::prefix('api/admin/manage')->group(function () {
        Route::get('/wallet', [WalletController::class, 'adminIndex'])->middleware('throttle:60,1');
        Route::patch('/wallet/requests/{walletRequest}', [WalletController::class, 'adminReview'])->whereNumber('walletRequest')->middleware('throttle:30,1');
        Route::post('/wallet/adjust', [WalletController::class, 'adminAdjust'])->middleware('throttle:30,1');
        Route::post('/wallet/qr', [WalletController::class, 'uploadQr'])->middleware('throttle:10,1');
        Route::delete('/wallet/qr', [WalletController::class, 'removeQr'])->middleware('throttle:10,1');
    });
});
