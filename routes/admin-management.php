<?php

use App\Http\Controllers\AdminManagementController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web','auth'])->prefix('api/admin/manage')->group(function(){
    Route::get('/workspace',[AdminManagementController::class,'workspace']);

    Route::post('/courses',[AdminManagementController::class,'createCourse']);
    Route::put('/courses/{course}',[AdminManagementController::class,'updateCourse'])->whereNumber('course');
    Route::delete('/courses/{course}',[AdminManagementController::class,'deleteCourse'])->whereNumber('course');
    Route::get('/courses/{course}/curriculum',[AdminManagementController::class,'getCurriculum'])->whereNumber('course');
    Route::put('/courses/{course}/curriculum',[AdminManagementController::class,'updateCurriculum'])->whereNumber('course');

    Route::post('/categories',[AdminManagementController::class,'createCategory']);
    Route::put('/categories/{category}',[AdminManagementController::class,'updateCategory'])->whereNumber('category');
    Route::delete('/categories/{category}',[AdminManagementController::class,'deleteCategory'])->whereNumber('category');

    Route::post('/users',[AdminManagementController::class,'createUser']);
    Route::put('/users/{user}',[AdminManagementController::class,'updateUser'])->whereNumber('user');

    Route::post('/enrollments',[AdminManagementController::class,'createEnrollment']);
    Route::delete('/enrollments/{enrollment}',[AdminManagementController::class,'deleteEnrollment'])->whereNumber('enrollment');

    Route::patch('/orders/{order}',[AdminManagementController::class,'updateOrder'])->whereNumber('order');

    Route::post('/coupons',[AdminManagementController::class,'createCoupon']);
    Route::put('/coupons/{coupon}',[AdminManagementController::class,'updateCoupon'])->whereNumber('coupon');
    Route::delete('/coupons/{coupon}',[AdminManagementController::class,'deleteCoupon'])->whereNumber('coupon');

    Route::patch('/reviews/{review}',[AdminManagementController::class,'updateReview'])->whereNumber('review');
    Route::delete('/reviews/{review}',[AdminManagementController::class,'deleteReview'])->whereNumber('review');
    Route::patch('/questions/{question}',[AdminManagementController::class,'updateQuestion'])->whereNumber('question');
    Route::delete('/questions/{question}',[AdminManagementController::class,'deleteQuestion'])->whereNumber('question');

    Route::post('/announcements',[AdminManagementController::class,'createAnnouncement']);
    Route::delete('/announcements/{announcement}',[AdminManagementController::class,'deleteAnnouncement'])->whereNumber('announcement');

    Route::put('/settings',[AdminManagementController::class,'updateSettings']);
});
