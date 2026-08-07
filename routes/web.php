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

Route::get('/login',fn()=>redirect('/login.html'))->name('login');
$serveHtml=function(string $file){$path=base_path($file);abort_unless(is_file($path),404);$html=file_get_contents($path);if(!str_contains($html,'backend-sync.js'))$html=str_ireplace('</body>','<script src="assets/backend-sync.js?v=20260808-1"></script>'.PHP_EOL.'</body>',$html);return response($html)->header('Content-Type','text/html; charset=UTF-8');};
$protected=['checkout.html','dashboard.html','my-learning.html','learn.html','certificate.html','account.html','orders.html','messages.html','notifications.html','success.html'];
foreach($protected as $file){Route::get('/'.$file,function()use($file,$serveHtml){return $serveHtml($file);})->middleware('auth');}
Route::get('/admin.html',function()use($serveHtml){abort_unless(auth()->user()?->role==='admin',403);return $serveHtml('admin.html');})->middleware('auth');
Route::get('/instructor.html',function()use($serveHtml){abort_unless(in_array(auth()->user()?->role,['admin','instructor'],true),403);return $serveHtml('instructor.html');})->middleware('auth');
Route::get('/',fn()=>$serveHtml('index.html'));
Route::get('/assets/{path}',function(string $path){abort_if(str_contains($path,'..'),404);$file=base_path('assets/'.$path);abort_unless(is_file($file),404);return response()->file($file);})->where('path','.*');
Route::get('/{page}.html',function(string $page)use($serveHtml){abort_unless((bool)preg_match('/^[A-Za-z0-9_-]+$/',$page),404);return $serveHtml($page.'.html');})->where('page','[A-Za-z0-9_-]+');
