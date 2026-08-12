<?php

use App\Http\Controllers\ActionAdController;
use App\Http\Controllers\AdminAdvertisementController;
use App\Http\Controllers\AdminExternalCourseController;
use App\Http\Controllers\AdminExtrasController;
use App\Http\Controllers\AdminManagementController;
use App\Http\Controllers\AdminPaymentOrderController;
use App\Http\Controllers\AiCareerAdController;
use App\Http\Controllers\CatalogMetadataController;
use App\Http\Controllers\CouponController;
use App\Http\Controllers\CourseAccessLinkController;
use App\Http\Controllers\CourseImageAssetController;
use App\Http\Controllers\EasypaisaPaymentController;
use App\Http\Controllers\FreeCourseController;
use App\Http\Controllers\HomepageCategoriesController;
use App\Http\Controllers\HomepageTrendingBannerAdController;
use App\Http\Controllers\HomepageTrendingCoursesController;
use App\Http\Controllers\ImageProxyController;
use App\Http\Controllers\LearningContentController;
use App\Http\Controllers\MessageCenterController;
use App\Http\Controllers\PromoMessageController;
use App\Http\Controllers\SubscriptionController;
use Illuminate\Support\Facades\Route;

Route::get('/api/categories',[CatalogMetadataController::class,'categories']);
Route::get('/api/platform',[CatalogMetadataController::class,'platform']);
Route::get('/api/learning-plans',[LearningContentController::class,'plans']);
Route::get('/api/payment/easypaisa',[EasypaisaPaymentController::class,'config']);
Route::get('/api/payment/easypaisa/qr',[EasypaisaPaymentController::class,'qr']);
Route::get('/api/homepage-trending-courses',[HomepageTrendingCoursesController::class,'publicIndex'])->middleware('throttle:120,1');
Route::get('/api/advertisements/homepage-before-trending-banner',[HomepageTrendingBannerAdController::class,'show'])->middleware('throttle:120,1');
Route::get('/api/image-proxy',ImageProxyController::class)->middleware('throttle:240,1');
Route::get('/api/course-images/{filename}',[CourseImageAssetController::class,'show'])->where('filename','[A-Za-z0-9._-]+')->middleware('throttle:240,1');
Route::get('/api/free-courses/{slug}',[FreeCourseController::class,'status'])->middleware('throttle:120,1');
Route::get('/api/advertisements/action-gates',[ActionAdController::class,'show'])->middleware('throttle:120,1');
Route::get('/api/advertisements/homepage-google-ai-popunder',[AdminAdvertisementController::class,'publicGoogleAiPopunder'])->middleware('throttle:120,1');
Route::get('/api/advertisements/course-detail-hero-ad',[AdminAdvertisementController::class,'publicCourseDetailHero'])->middleware('throttle:120,1');
Route::get('/api/advertisements/homepage-ai-career-learn-more-ad',[AiCareerAdController::class,'show'])->middleware('throttle:120,1');

Route::middleware('auth')->group(function(){
    Route::post('/api/coupons/quote',[CouponController::class,'quote'])->middleware('throttle:30,1');
    Route::post('/api/checkout/easypaisa',[EasypaisaPaymentController::class,'submit'])->middleware('throttle:10,1');
    Route::post('/api/free-courses/{slug}/enroll',[FreeCourseController::class,'enroll'])->middleware('throttle:20,1');
    Route::get('/api/course-access-links',[CourseAccessLinkController::class,'learner'])->middleware('throttle:60,1');
    Route::get('/api/message-center',[MessageCenterController::class,'userIndex'])->middleware('throttle:60,1');
    Route::post('/api/message-center',[MessageCenterController::class,'userSend'])->middleware('throttle:30,1');
    Route::get('/api/subscription',[SubscriptionController::class,'current']);
    Route::post('/api/subscription',[SubscriptionController::class,'start']);
    Route::delete('/api/subscription',[SubscriptionController::class,'cancel']);
    Route::get('/api/courses/{slug}/assessments',[LearningContentController::class,'assessments']);
    Route::post('/api/assessments/{assessment}/submit',[LearningContentController::class,'submitAssessment'])->whereNumber('assessment');

    Route::prefix('api/admin/manage')->group(function(){
        Route::get('/workspace',[AdminManagementController::class,'workspace']);
        Route::get('/extras',[AdminExtrasController::class,'index']);
        Route::get('/messages',[MessageCenterController::class,'adminIndex'])->middleware('throttle:60,1');
        Route::post('/messages/{user}/reply',[MessageCenterController::class,'adminReply'])->whereNumber('user')->middleware('throttle:30,1');
        Route::get('/course-links',[CourseAccessLinkController::class,'adminIndex']);
        Route::put('/course-links/{course}',[CourseAccessLinkController::class,'adminUpdate'])->whereNumber('course');
        Route::get('/free-course-statuses',[FreeCourseController::class,'adminIndex'])->middleware('throttle:60,1');
        Route::put('/courses/{course}/free-status',[FreeCourseController::class,'adminUpdate'])->whereNumber('course')->middleware('throttle:30,1');
        Route::get('/promo-message',[PromoMessageController::class,'show']);
        Route::put('/promo-message',[PromoMessageController::class,'update'])->middleware('throttle:30,1');
        Route::get('/homepage-categories',[HomepageCategoriesController::class,'show']);
        Route::put('/homepage-categories',[HomepageCategoriesController::class,'update'])->middleware('throttle:30,1');
        Route::get('/homepage-trending-courses',[HomepageTrendingCoursesController::class,'show'])->middleware('throttle:60,1');
        Route::put('/homepage-trending-courses',[HomepageTrendingCoursesController::class,'update'])->middleware('throttle:30,1');

        Route::get('/advertisements',[AdminAdvertisementController::class,'index'])->middleware('throttle:60,1');
        Route::post('/advertisements',[AdminAdvertisementController::class,'store'])->middleware('throttle:30,1');
        Route::put('/advertisement-placements/course-enroll-now-ad',[ActionAdController::class,'assignEnroll'])->middleware('throttle:30,1');
        Route::put('/advertisement-placements/checkout-coupon-apply-ad',[ActionAdController::class,'assignCoupon'])->middleware('throttle:30,1');
        Route::put('/advertisement-placements/homepage-google-ai-popunder',[AdminAdvertisementController::class,'assignGoogleAiPopunder'])->middleware('throttle:30,1');
        Route::put('/advertisement-placements/homepage-popular-skills-longbar',[AdminAdvertisementController::class,'assignPopularSkillsLongbar'])->middleware('throttle:30,1');
        Route::put('/advertisement-placements/course-detail-hero-ad',[AdminAdvertisementController::class,'assignCourseDetailHero'])->middleware('throttle:30,1');
        Route::put('/advertisement-placements/homepage-before-trending-banner',[HomepageTrendingBannerAdController::class,'assign'])->middleware('throttle:30,1');
        Route::put('/advertisement-placements/homepage-ai-career-learn-more-ad',[AiCareerAdController::class,'assign'])->middleware('throttle:30,1');
        Route::put('/advertisements/{advertisement}',[AdminAdvertisementController::class,'update'])->whereNumber('advertisement')->middleware('throttle:30,1');
        Route::delete('/advertisements/{advertisement}',[AdminAdvertisementController::class,'destroy'])->whereNumber('advertisement')->middleware('throttle:30,1');

        Route::post('/course-images',[CourseImageAssetController::class,'upload'])->middleware('throttle:30,1');
        Route::post('/course-images/import',[CourseImageAssetController::class,'importUrl'])->middleware('throttle:30,1');
        Route::post('/courses',[AdminExternalCourseController::class,'create']);
        Route::put('/courses/{course}',[AdminExternalCourseController::class,'update'])->whereNumber('course');
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

        Route::patch('/orders/{order}',[AdminPaymentOrderController::class,'update'])->whereNumber('order');

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

        Route::post('/payment/easypaisa-qr',[EasypaisaPaymentController::class,'uploadQr'])->middleware('throttle:10,1');
        Route::delete('/payment/easypaisa-qr',[EasypaisaPaymentController::class,'removeQr'])->middleware('throttle:10,1');

        Route::put('/settings',[AdminManagementController::class,'updateSettings']);
    });
});
