<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user=$request->user();
        if($user && (($user->status??'active')!=='active')){
            Auth::logout();
            if($request->hasSession()){
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }
            if($request->is('api/*')||$request->expectsJson())return response()->json(['message'=>'This account is suspended.'],403);
            return redirect('/login')->with('error','This account is suspended.');
        }
        return $next($request);
    }
}
