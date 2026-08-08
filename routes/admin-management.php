<?php

use App\Http\Controllers\AdminExtrasController;
use App\Http\Controllers\AdminManagementController;
use App\Http\Controllers\AdminOrderController;
use App\Http\Controllers\CatalogMetadataController;
use App\Http\Controllers\LearningContentController;
use App\Http\Controllers\SubscriptionController;
use Illuminate\Support\Facades\Route;

Route::get('/api/categories',[CatalogMetadataController::class,'categories']);
Route::get('/api/platform',[CatalogMetadataController::class,'platform']);
Route::get('/api/learning-plans',[LearningContentController::class,'plans']);

Route::middleware('auth')->group(function(){
    Route::get('/api/subscription',[SubscriptionController::class,'current']);
    Route::post('/api/subscription',[SubscriptionController::class,'start']);
    Route::delete('/api/subscription',[SubscriptionController::class,'cancel']);
    Route::get('/api/courses/{slug}/assessments',[LearningContentController::class,'assessments']);
    Route::post('/api/assessments/{assessment}/submit',[LearningContentController::class,'submitAssessment'])->whereNumber('assessment');

    Route::prefix('api/admin/manage')->group(function(){
        Route::get('/workspace',[AdminManagementController::class,'workspace']);
        Route::get('/extras',[AdminExtrasController::class,'index']);

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

        Route::patch('/orders/{order}',[AdminOrderController::class,'update'])->whereNumber('order');

        Route::post('/coupons',[AdminManagementController::class,'createCoupon']);
        Route::put('/coupons/{coupon}',[AdminManagementController::class,'updateCoupon'])->whereNumber('coupon');
        Route::delete('/coupons/{coupon}',[AdminManagementController::class,'deleteCoupon'])->whereNumber('coupon');

        Route::patch('/reviews/{review}',[AdminManagementController::class,'updateReview'])->whereNumber('review');
        Route::delete('/reviews/{review}',[AdminManagementController::class,'deleteReview'])->whereNumber('review');
        Route::patch('/questions/{question}',[AdminManagementController::class,'updateQuestion'])->whereNumber('question');
        Route::delete('/questions/{question}',[AdminManagementController::class,'deleteQuestion'])->whereNumber('question');

        Route::post('/announcements',[AdminManagementController::class,'createAnnouncement']);
        Route::delete('/announcements/{announcement}',[AdminManagementController::class,'deleteAnnouncement'])->whereNumber('announcement');

        Route::post('/plans',[AdminExtrasController::class,'createPlan']);
        Route::put('/plans/{plan}',[AdminExtrasController::class,'updatePlan'])->whereNumber('plan');
        Route::delete('/plans/{plan}',[AdminExtrasController::class,'deletePlan'])->whereNumber('plan');

        Route::post('/assessments',[AdminExtrasController::class,'createAssessment']);
        Route::put('/assessments/{assessment}',[AdminExtrasController::class,'updateAssessment'])->whereNumber('assessment');
        Route::delete('/assessments/{assessment}',[AdminExtrasController::class,'deleteAssessment'])->whereNumber('assessment');

        Route::put('/settings',[AdminManagementController::class,'updateSettings']);
    });
});
