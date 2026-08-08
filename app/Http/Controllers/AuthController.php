<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function session(Request $request): JsonResponse
    {
        return response()->json([
            'authenticated'=>Auth::check(),
            'csrf_token'=>csrf_token(),
            'user'=>$request->user()?->only(['id','name','email','role']),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
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
        ]);

        Auth::login($user, false);
        $request->session()->regenerate();

        return response()->json([
            'user'=>$user->only(['id','name','email','role']),
            'csrf_token'=>csrf_token(),
            'redirect'=>$request->session()->pull('url.intended','/dashboard'),
        ],201);
    }

    public function login(Request $request): JsonResponse
    {
        $data=$request->validate([
            'email'=>['required','email','max:190'],
            'password'=>['required','string','max:200'],
        ]);

        $email=strtolower(trim($data['email']));
        $user=User::where('email',$email)->first();
        $valid=false;

        if($user){
            try {
                $valid=Hash::check($data['password'],$user->getAuthPassword());
            } catch (\Throwable $e) {
                Log::warning('Authentication hash check failed',['user_id'=>$user->id,'exception'=>get_class($e)]);
            }
        }

        if(!$user||!$valid){
            throw ValidationException::withMessages(['email'=>'The provided credentials are incorrect.']);
        }

        // Avoid persistent "remember me" writes on shared hosting. The normal
        // encrypted Laravel session is enough for the academy sign-in flow.
        Auth::login($user, false);
        $request->session()->regenerate();

        return response()->json([
            'user'=>$user->only(['id','name','email','role']),
            'csrf_token'=>csrf_token(),
            'redirect'=>$request->session()->pull('url.intended','/dashboard'),
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
        return response()->json(['user'=>$user->only(['id','name','email','role'])]);
    }
}
