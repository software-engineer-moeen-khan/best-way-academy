<?php

use App\Http\Controllers\PlatformController;
use Illuminate\Support\Facades\Route;

Route::get('/api/health', fn()=>response()->json(['ok'=>true,'app'=>'Best Way Academy','time'=>now()->toIso8601String()]));
Route::get('/api/session',[PlatformController::class,'session']);
Route::post('/api/auth/register',[PlatformController::class,'register']);
Route::post('/api/auth/login',[PlatformController::class,'login']);
Route::get('/api/courses',[PlatformController::class,'courses']);
Route::get('/api/courses/{slug}',[PlatformController::class,'course']);
Route::get('/api/courses/{slug}/reviews',[PlatformController::class,'reviews']);
Route::get('/api/courses/{slug}/questions',[PlatformController::class,'questions']);
Route::middleware('auth')->group(function(){
    Route::post('/api/auth/logout',[PlatformController::class,'logout']);
    Route::put('/api/profile',[PlatformController::class,'profile']);
    Route::get('/api/bootstrap',[PlatformController::class,'bootstrap']);
    Route::put('/api/state',[PlatformController::class,'putState']);
    Route::delete('/api/state',[PlatformController::class,'deleteState']);
    Route::put('/api/global-state',[PlatformController::class,'putGlobalState']);
    Route::post('/api/checkout',[PlatformController::class,'checkout']);
    Route::post('/api/courses/{slug}/progress/sync',[PlatformController::class,'syncProgress']);
    Route::post('/api/courses/{slug}/reviews',[PlatformController::class,'storeReview']);
    Route::post('/api/courses/{slug}/questions',[PlatformController::class,'storeQuestion']);
    Route::post('/api/questions/{question}/answers',[PlatformController::class,'answer']);
    Route::get('/api/messages',[PlatformController::class,'messages']);
    Route::post('/api/messages',[PlatformController::class,'sendMessage']);
    Route::post('/api/instructor/courses/sync',[PlatformController::class,'syncCourseOverrides']);
    Route::post('/api/instructor/courses/{slug}/curriculum/sync',[PlatformController::class,'syncCurriculum']);
});

$serveHtml=function(string $file){
    $path=base_path($file);
    abort_unless(is_file($path),404);
    $html=file_get_contents($path);
    if(!str_contains($html,'backend-sync.js')){
        $html=str_ireplace('</body>','<script src="/assets/backend-sync.js?v=20260808-2"></script>'.PHP_EOL.'</body>',$html);
    }
    return response($html)->header('Content-Type','text/html; charset=UTF-8');
};

Route::get('/',fn()=>$serveHtml('index.html'))->name('home');

$publicPages=[
    'about'=>'about.html',
    'cart'=>'cart.html',
    'categories'=>'categories.html',
    'contact'=>'contact.html',
    'course'=>'course.html',
    'courses'=>'courses.html',
    'faq'=>'faq.html',
    'gift'=>'gift.html',
    'instructor-profile'=>'instructor-profile.html',
    'plans'=>'plans.html',
    'practice'=>'practice.html',
    'privacy'=>'privacy.html',
    'signup'=>'signup.html',
    'teach'=>'teach.html',
    'terms'=>'terms.html',
    'wishlist'=>'wishlist.html',
];
foreach($publicPages as $uri=>$file){
    Route::get('/'.$uri,fn()=>$serveHtml($file));
}
Route::get('/login',fn()=>$serveHtml('login.html'))->name('login');

$protectedPages=[
    'account'=>'account.html',
    'certificate'=>'certificate.html',
    'checkout'=>'checkout.html',
    'dashboard'=>'dashboard.html',
    'learn'=>'learn.html',
    'messages'=>'messages.html',
    'my-learning'=>'my-learning.html',
    'notifications'=>'notifications.html',
    'orders'=>'orders.html',
    'success'=>'success.html',
];
foreach($protectedPages as $uri=>$file){
    Route::get('/'.$uri,fn()=>$serveHtml($file))->middleware('auth');
}

Route::get('/admin',function()use($serveHtml){
    abort_unless(auth()->user()?->role==='admin',403);
    return $serveHtml('admin.html');
})->middleware('auth');

Route::get('/instructor',function()use($serveHtml){
    abort_unless(in_array(auth()->user()?->role,['admin','instructor'],true),403);
    return $serveHtml('instructor.html');
})->middleware('auth');

// Friendly course-specific clean URLs while keeping the existing frontend query contract.
Route::get('/course/{slug}',fn(string $slug)=>redirect('/course?course='.rawurlencode($slug),302));
Route::get('/learn/{slug}',fn(string $slug)=>redirect('/learn?course='.rawurlencode($slug),302))->middleware('auth');
Route::get('/certificate/{slug}',fn(string $slug)=>redirect('/certificate?course='.rawurlencode($slug),302))->middleware('auth');

Route::get('/assets/{path}',function(string $path){
    abort_if(str_contains($path,'..'),404);
    $file=base_path('assets/'.$path);
    abort_unless(is_file($file),404);
    return response()->file($file);
})->where('path','.*');

// Backwards compatibility: old .html links permanently redirect to clean Laravel URLs.
$legacy=[
    'index'=>'/',
    'about'=>'/about','account'=>'/account','admin'=>'/admin','cart'=>'/cart','categories'=>'/categories',
    'certificate'=>'/certificate','checkout'=>'/checkout','contact'=>'/contact','course'=>'/course','courses'=>'/courses',
    'dashboard'=>'/dashboard','faq'=>'/faq','gift'=>'/gift','instructor-profile'=>'/instructor-profile','instructor'=>'/instructor',
    'learn'=>'/learn','login'=>'/login','messages'=>'/messages','my-learning'=>'/my-learning','notifications'=>'/notifications',
    'orders'=>'/orders','plans'=>'/plans','practice'=>'/practice','privacy'=>'/privacy','signup'=>'/signup','success'=>'/success',
    'teach'=>'/teach','terms'=>'/terms','wishlist'=>'/wishlist',
];
Route::get('/{page}.html',function(string $page)use($legacy){
    abort_unless(isset($legacy[$page]),404);
    $query=request()->getQueryString();
    $target=$legacy[$page].($query?'?'.$query:'');
    return redirect($target,301);
})->where('page','[A-Za-z0-9_-]+');
