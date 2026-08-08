<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SubscriptionController extends Controller
{
    public function current(Request $request): JsonResponse
    {
        $subscription=DB::table('subscriptions')->where('user_id',$request->user()->id)->latest('created_at')->first();
        if(!$subscription)return response()->json(['subscription'=>null]);
        $plan=DB::table('learning_plans')->where('slug',$subscription->plan)->first();
        return response()->json(['subscription'=>[
            'id'=>$subscription->id,'plan'=>$subscription->plan,'plan_name'=>$plan?->name??$subscription->plan,
            'status'=>$subscription->status,'starts_at'=>$subscription->starts_at,'ends_at'=>$subscription->ends_at,
            'created_at'=>$subscription->created_at,
        ]]);
    }

    public function start(Request $request): JsonResponse
    {
        $data=$request->validate(['plan_slug'=>['required','string','max:120']]);
        $plan=DB::table('learning_plans')->where('slug',$data['plan_slug'])->where('active',true)->first();
        abort_unless($plan,422,'Selected learning plan is unavailable.');
        $userId=$request->user()->id;
        DB::table('subscriptions')->where('user_id',$userId)->whereIn('status',['pending_payment','active'])->update(['status'=>'cancelled','updated_at'=>now()]);
        $id=DB::table('subscriptions')->insertGetId([
            'user_id'=>$userId,'plan'=>$plan->slug,'status'=>'pending_payment','starts_at'=>null,'ends_at'=>null,
            'provider_ref'=>null,'created_at'=>now(),'updated_at'=>now(),
        ]);
        return response()->json([
            'ok'=>true,'subscription_id'=>$id,'status'=>'pending_payment',
            'message'=>'Plan selected. Payment activation will complete after a payment provider is configured.',
        ],201);
    }

    public function cancel(Request $request): JsonResponse
    {
        DB::table('subscriptions')->where('user_id',$request->user()->id)->whereIn('status',['pending_payment','active'])->update(['status'=>'cancelled','ends_at'=>now(),'updated_at'=>now()]);
        return response()->json(['ok'=>true,'status'=>'cancelled']);
    }
}
