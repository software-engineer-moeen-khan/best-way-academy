<?php

use App\Http\Controllers\AdminOverviewController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BootstrapController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\CourseViewController;
use App\Http\Controllers\InstructorOverviewController;
use App\Http\Controllers\PlatformController;
use App\Http\Controllers\ProgressController;
use App\Http\Controllers\SupportController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/api/health', function(){
    try {
        DB::select('select 1');
        return response()->json(['ok'=>true,'app'=>'Best Way Academy','db'=>'connected','time'=>now()->toIso8601String()]);
    } catch (Throwable $e) {
        return response()->json(['ok'=>false,'app'=>'Best Way Academy','db'=>'unavailable','time'=>now()->toIso8601String()],503);
    }
});
Route::get('/api/session',[AuthController::class,'session']);
Route::post('/api/auth/register',[AuthController::class,'register'])->middleware('throttle:4,1');
Route::post('/api/auth/login',[AuthController::class,'login']);
Route::post('/api/contact',[SupportController::class,'store'])->middleware('throttle:5,1');
Route::get('/api/courses',[PlatformController::class,'courses']);
Route::get('/api/courses/{slug}',CourseViewController::class);
Route::get('/api/courses/{slug}/reviews',[PlatformController::class,'reviews']);
Route::get('/api/courses/{slug}/questions',[PlatformController::class,'questions']);
Route::middleware('auth')->group(function(){
    Route::post('/api/auth/logout',[AuthController::class,'logout']);
    Route::put('/api/profile',[AuthController::class,'profile'])->middleware('throttle:20,1');
    Route::get('/api/bootstrap',BootstrapController::class);
    Route::put('/api/state',[PlatformController::class,'putState'])->middleware('throttle:120,1');
    Route::delete('/api/state',[PlatformController::class,'deleteState'])->middleware('throttle:120,1');
    Route::put('/api/global-state',[PlatformController::class,'putGlobalState'])->middleware('throttle:60,1');
    Route::delete('/api/global-state',[PlatformController::class,'deleteGlobalState'])->middleware('throttle:60,1');
    Route::post('/api/checkout',CheckoutController::class)->middleware('throttle:10,1');
    Route::post('/api/courses/{slug}/progress/sync',[ProgressController::class,'sync'])->middleware('throttle:120,1');
    Route::post('/api/courses/{slug}/reviews',[PlatformController::class,'storeReview'])->middleware('throttle:10,1');
    Route::post('/api/courses/{slug}/questions',[PlatformController::class,'storeQuestion'])->middleware('throttle:20,1');
    Route::post('/api/questions/{question}/answers',[PlatformController::class,'answer'])->middleware('throttle:30,1');
    Route::get('/api/messages',[PlatformController::class,'messages'])->middleware('throttle:60,1');
    Route::post('/api/messages',[PlatformController::class,'sendMessage'])->middleware('throttle:30,1');
    Route::get('/api/admin/overview',AdminOverviewController::class)->middleware('throttle:60,1');
    Route::get('/api/instructor/overview',InstructorOverviewController::class)->middleware('throttle:60,1');
    Route::get('/api/admin/support-requests',[SupportController::class,'index'])->middleware('throttle:60,1');
    Route::patch('/api/admin/support-requests/{supportRequest}',[SupportController::class,'updateStatus'])->middleware('throttle:30,1');
    Route::post('/api/instructor/courses/sync',[PlatformController::class,'syncCourseOverrides'])->middleware('throttle:30,1');
    Route::post('/api/instructor/courses/{slug}/curriculum/sync',[PlatformController::class,'syncCurriculum'])->middleware('throttle:30,1');
    Route::post('/api/instructor/courses/{slug}/announcements/sync',[PlatformController::class,'syncAnnouncements'])->middleware('throttle:30,1');
    Route::post('/api/instructor/coupons/sync',[PlatformController::class,'syncCoupons'])->middleware('throttle:30,1');
});

require base_path('routes/admin-management.php');

Route::any('/api',fn()=>response()->json(['message'=>'API endpoint not found.'],404));
Route::any('/api/{path}',fn()=>response()->json(['message'=>'API endpoint not found.'],404))->where('path','.*');

$serveHtml=function(string $file){
    $path=base_path($file);
    abort_unless(is_file($path),404);
    $html=file_get_contents($path);

    $html=str_replace(['href="assets/','src="assets/'],['href="/assets/','src="/assets/'],$html);
    $html=preg_replace('/(\/assets\/[A-Za-z0-9_.\/-]+\.(?:css|js))(?:\?v[^"\']*)?/','$1?v=20260810-38',$html);

    if(!str_contains($html,'portal-polish.css')){
        $html=str_ireplace('</head>','  <link rel="stylesheet" href="/assets/portal-polish.css?v=20260810-38">'.PHP_EOL.'</head>',$html);
    }
    if(!str_contains($html,'responsive-final.css')){
        $html=str_ireplace('</head>','  <link rel="stylesheet" href="/assets/responsive-final.css?v=20260810-38">'.PHP_EOL.'</head>',$html);
    }
    if(!str_contains($html,'responsive-unified.css')){
        $html=str_ireplace('</head>','  <link rel="stylesheet" data-bwa-responsive-unified="1" href="/assets/responsive-unified.css?v=20260810-38">'.PHP_EOL.'</head>',$html);
    }
    if(!str_contains($html,'backend-sync.js')){
        $html=str_ireplace('</body>','<script src="/assets/backend-sync.js?v=20260810-38"></script>'.PHP_EOL.'</body>',$html);
    }
    if(!str_contains($html,'backend-actions.js')){
        $html=str_ireplace('</body>','<script src="/assets/backend-actions.js?v=20260810-38"></script>'.PHP_EOL.'</body>',$html);
    }
    if(!str_contains($html,'admin-backend.js')){
        $html=str_ireplace('</body>','<script src="/assets/admin-backend.js?v=20260810-38"></script>'.PHP_EOL.'</body>',$html);
    }
    if(!str_contains($html,'instructor-backend.js')){
        $html=str_ireplace('</body>','<script src="/assets/instructor-backend.js?v=20260810-38"></script>'.PHP_EOL.'</body>',$html);
    }
    if(!str_contains($html,'clean-route-fixes.js')){
        $html=str_ireplace('</body>','<script src="/assets/clean-route-fixes.js?v=20260810-38"></script>'.PHP_EOL.'</body>',$html);
    }
    if(!str_contains($html,'portal-polish.js')){
        $html=str_ireplace('</body>','<script src="/assets/portal-polish.js?v=20260810-38"></script>'.PHP_EOL.'</body>',$html);
    }

    return response($html)
        ->header('Content-Type','text/html; charset=UTF-8')
        ->header('Cache-Control','no-cache, no-store, must-revalidate')
        ->header('Pragma','no-cache')
        ->header('Expires','0');
};

$courseAccess=function(bool $requireCompletion=false): bool {
    $slug=(string)request()->query('course','python');
    $course=DB::table('courses')->where('slug',$slug)->first();
    if(!$course)return false;
    $user=auth()->user();if(!$user)return false;
    if($user->role==='admin'||($user->role==='instructor'&&(int)$course->instructor_id===(int)$user->id))return true;
    $enrollment=DB::table('enrollments')->where('user_id',$user->id)->where('course_id',$course->id)->first();
    if(!$enrollment)return false;
    return !$requireCompletion||(int)$enrollment->progress>=100;
};

Route::get('/',fn()=>$serveHtml('index.html'))->name('home');

$publicPages=[
    'about'=>'about.html','cart'=>'cart.html','categories'=>'categories.html','contact'=>'contact.html','course'=>'course.html',
    'courses'=>'courses.html','faq'=>'faq.html','gift'=>'gift.html','instructor-profile'=>'instructor-profile.html','plans'=>'plans.html',
    'privacy'=>'privacy.html','signup'=>'signup.html','teach'=>'teach.html','terms'=>'terms.html','wishlist'=>'wishlist.html',
];
foreach($publicPages as $uri=>$file){Route::get('/'.$uri,fn()=>$serveHtml($file));}
Route::get('/login',fn()=>$serveHtml('login.html'))->name('login');

$protectedPages=[
    'account'=>'account.html','checkout'=>'checkout.html','messages'=>'messages.html','my-learning'=>'my-learning.html',
    'notifications'=>'notifications.html','orders'=>'orders.html','success'=>'success.html',
];
foreach($protectedPages as $uri=>$file){Route::get('/'.$uri,fn()=>$serveHtml($file))->middleware('auth');}

Route::get('/dashboard',function()use($serveHtml){
    return match(auth()->user()?->role){
        'admin'=>redirect('/admin'),
        'instructor'=>redirect('/instructor'),
        default=>$serveHtml('dashboard.html'),
    };
})->middleware('auth');

Route::get('/learn',function()use($serveHtml,$courseAccess){return $courseAccess()?$serveHtml('learn.html'):$serveHtml('403.html')->setStatusCode(403);})->middleware('auth');
Route::get('/practice',function()use($serveHtml,$courseAccess){return $courseAccess()?$serveHtml('practice.html'):$serveHtml('403.html')->setStatusCode(403);})->middleware('auth');
Route::get('/certificate',function()use($serveHtml,$courseAccess){return $courseAccess(true)?$serveHtml('certificate.html'):$serveHtml('403.html')->setStatusCode(403);})->middleware('auth');

Route::get('/admin',function()use($serveHtml){
    if(auth()->user()?->role!=='admin')return $serveHtml('403.html')->setStatusCode(403);
    return $serveHtml('admin.html');
})->middleware('auth');
Route::get('/instructor',function()use($serveHtml){
    if(!in_array(auth()->user()?->role,['admin','instructor'],true))return $serveHtml('403.html')->setStatusCode(403);
    return $serveHtml('instructor.html');
})->middleware('auth');

Route::get('/course/{slug}',fn(string $slug)=>redirect('/course?course='.rawurlencode($slug),302));
Route::get('/learn/{slug}',fn(string $slug)=>redirect('/learn?course='.rawurlencode($slug),302))->middleware('auth');
Route::get('/practice/{slug}',fn(string $slug)=>redirect('/practice?course='.rawurlencode($slug),302))->middleware('auth');
Route::get('/certificate/{slug}',fn(string $slug)=>redirect('/certificate?course='.rawurlencode($slug),302))->middleware('auth');

Route::get('/assets/{path}',function(string $path){
    abort_if(str_contains($path,'..'),404);$file=base_path('assets/'.$path);abort_unless(is_file($file),404);
    return response()->file($file,['Cache-Control'=>'public, max-age=300']);
})->where('path','.*');

$legacy=[
    'index'=>'/','about'=>'/about','account'=>'/account','admin'=>'/admin','cart'=>'/cart','categories'=>'/categories','certificate'=>'/certificate',
    'checkout'=>'/checkout','contact'=>'/contact','course'=>'/course','courses'=>'/courses','dashboard'=>'/dashboard','faq'=>'/faq','gift'=>'/gift',
    'instructor-profile'=>'/instructor-profile','instructor'=>'/instructor','learn'=>'/learn','login'=>'/login','messages'=>'/messages',
    'my-learning'=>'/my-learning','notifications'=>'/notifications','orders'=>'/orders','plans'=>'/plans','practice'=>'/practice','privacy'=>'/privacy',
    'signup'=>'/signup','success'=>'/success','teach'=>'/teach','terms'=>'/terms','wishlist'=>'/wishlist',
];
Route::get('/{page}.html',function(string $page)use($legacy){
    abort_unless(isset($legacy[$page]),404);$query=request()->getQueryString();return redirect($legacy[$page].($query?'?'.$query:''),301);
})->where('page','[A-Za-z0-9_-]+');

Route::fallback(function()use($serveHtml){
    return $serveHtml('404.html')->setStatusCode(404);
});
