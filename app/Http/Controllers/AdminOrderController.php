<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminOrderController extends Controller
{
    public function update(Request $request,int $order): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);
        $existing=DB::table('orders')->where('id',$order)->first();
        abort_unless($existing,404);
        $data=$request->validate([
            'status'=>['required','string','in:pending,completed,refunded,cancelled'],
            'payment_method'=>['sometimes','nullable','string','max:50'],
        ]);
        $update=['status'=>$data['status'],'updated_at'=>now()];
        if(array_key_exists('payment_method',$data))$update['payment_method']=$data['payment_method'];
        DB::table('orders')->where('id',$order)->update($update);
        return response()->json(['ok'=>true]);
    }
}
