<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminPaymentOrderController extends Controller
{
    public function update(Request $request,int $order): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);
        $data=$request->validate([
            'status'=>['required','string','in:pending,completed,refunded,cancelled'],
            'payment_method'=>['nullable','string','max:50'],
        ]);

        $row=DB::table('orders')->where('id',$order)->first();
        abort_unless($row,404);

        DB::transaction(function()use($row,$order,$data){
            $fresh=DB::table('orders')->where('id',$order)->lockForUpdate()->first();
            abort_unless($fresh,404);
            $meta=is_string($fresh->metadata)?(json_decode($fresh->metadata,true)?:[]):((array)($fresh->metadata??[]));

            if($data['status']==='completed'&&$fresh->status!=='completed'){
                $items=DB::table('order_items')->where('order_id',$order)->get();
                foreach($items as $item){
                    $inserted=DB::table('enrollments')->insertOrIgnore([
                        'user_id'=>$fresh->user_id,'course_id'=>$item->course_id,'progress'=>0,
                        'enrolled_at'=>now(),'created_at'=>now(),'updated_at'=>now(),
                    ]);
                    if($inserted)DB::table('courses')->where('id',$item->course_id)->increment('students_count');
                }
                $meta['enrollment_granted']=true;
                $meta['payment_verified_at']=now()->toIso8601String();
                $meta['payment_verified_by']=auth()->id();

                if(!empty($meta['coupon_code'])&&empty($meta['coupon_counted'])){
                    $coupon=DB::table('coupons')->where('code',strtoupper((string)$meta['coupon_code']))->first();
                    if($coupon)DB::table('coupons')->where('id',$coupon->id)->increment('uses');
                    $meta['coupon_counted']=true;
                }
            }

            DB::table('orders')->where('id',$order)->update([
                'status'=>$data['status'],
                'payment_method'=>$data['payment_method']??$fresh->payment_method,
                'metadata'=>json_encode($meta,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),
                'updated_at'=>now(),
            ]);
        });

        return response()->json(['ok'=>true]);
    }
}
