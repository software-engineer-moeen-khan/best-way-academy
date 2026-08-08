<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private function attemptKey(Request $request,string $kind,string $email): string
    {
        return hash('sha256',$kind.'|'.strtolower(trim($email)).'|'.($request->ip()?:'unknown'));
    }

    private function enforceLoginLimit(Request $request,string $email): string
    {
        $key=$this->attemptKey($request,'login',$email);
        DB::table('auth_attempts')->where('key_hash',$key)->where('attempted_at','<',now()->subMinutes(15))->delete();
        $recent=DB::table('auth_attempts')->where('key_hash',$key)->where('attempted_at','>=',now()->subMinute())->count();
        abort_if($recent>=8,429,'Too many sign-in attempts. Please wait one minute and try again.');
        return $key;
    }

    private function recordFailedLogin(string $key): void
    {
        DB::table('auth_attempts')->insert(['key_hash'=>$key,'kind'=>'login','attempted_at'=>now()]);
    }

    private function roleDashboard(User $user): string
    {
        return match ($user->role) {
            'admin' => '/admin',
            'instructor' => '/instructor',
            default => '/dashboard',
        };
    }

    private function postLoginRedirect(Request $request,User $user): string
    {
        $fallback=$this->roleDashboard($user);
        $intended=$request->session()->pull('url.intended');
        if(!$intended)return $fallback;
        $path=parse_url((string)$intended,PHP_URL_PATH)?:'/';
        if(in_array($path,['/dashboard','/dashboard.html'],true))return $fallback;
        return (string)$intended;
    }

    private function registrationAllowed(): bool
    {
        if(!Schema::hasTable('platform_settings'))return true;
        $raw=DB::table('platform_settings')->where('key','allow_registration')->value('value');
        if($raw===null)return true;
        $value=is_string($raw)?json_decode($raw,true):$raw;
        return $value!==false;
    }

    public function session(Request $request): JsonResponse
    {
        return response()->json([
            'authenticated'=>Auth::check(),
            'csrf_token'=>csrf_token(),
            'user'=>$request->user()?->only(['id','name','email','role','status']),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        abort_unless($this->registrationAllowed(),403,'New account registration is currently disabled.');
        $data=$request->validate([
            'name'=>['required','string','max:120'],
            'email'=>['required','email','max:190','unique:users,email'],
            'password'=>['required','string','min:8','max:200'],
        ]);

        $user=User::create([
            'name'=>trim($data['name']),
            'email'=>strtolower(trim($data['email'])),
            'password'=>$data['password'],
            'role'=>'student',
            'status'=>'active',
        ]);

        Auth::login($user,false);
        $request->session()->regenerate();
        return response()->json([
            'user'=>$user->only(['id','name','email','role','status']),
            'csrf_token'=>csrf_token(),
            'redirect'=>$this->postLoginRedirect($request,$user),
        ],201);
    }

    public function login(Request $request): JsonResponse
    {
        $data=$request->validate([
            'email'=>['required','email','max:190'],
            'password'=>['required','string','max:200'],
        ]);
        $email=strtolower(trim($data['email']));
        $attemptKey=$this->enforceLoginLimit($request,$email);
        $user=User::where('email',$email)->first();
        $valid=false;
        if($user){
            try {$valid=Hash::check($data['password'],$user->getAuthPassword());}
            catch (\Throwable $e){Log::warning('Authentication hash check failed',['user_id'=>$user->id,'exception'=>get_class($e)]);}
        }
        if(!$user||!$valid){
            $this->recordFailedLogin($attemptKey);
            throw ValidationException::withMessages(['email'=>'The provided credentials are incorrect.']);
        }
        if(($user->status??'active')!=='active'){
            $this->recordFailedLogin($attemptKey);
            throw ValidationException::withMessages(['email'=>'This account is suspended. Contact the academy administrator.']);
        }

        DB::table('auth_attempts')->where('key_hash',$attemptKey)->delete();
        Auth::login($user,false);
        $request->session()->regenerate();
        return response()->json([
            'user'=>$user->only(['id','name','email','role','status']),
            'csrf_token'=>csrf_token(),
            'redirect'=>$this->postLoginRedirect($request,$user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->json(['ok'=>true,'csrf_token'=>csrf_token()]);
    }

    public function profile(Request $request): JsonResponse
    {
        $user=$request->user();
        $data=$request->validate([
            'name'=>['required','string','max:120'],
            'email'=>['required','email','max:190','unique:users,email,'.$user->id],
        ]);
        $user->update(['name'=>trim($data['name']),'email'=>strtolower(trim($data['email']))]);
        return response()->json(['user'=>$user->only(['id','name','email','role','status'])]);
    }
}
