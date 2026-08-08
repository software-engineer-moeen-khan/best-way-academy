<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CouponController extends Controller
{
    public function quote(Request $request): JsonResponse
    {
        $data=$request->validate([
            'course_slugs'=>['required','array','min:1','max:50'],
            'course_slugs.*'=>['required','string','max:120'],
            'coupon_code'=>['required','string','max:80'],
        ]);

        $slugs=array_values(array_unique(array_map(fn($slug)=>trim((string)$slug),$data['course_slugs'])));
        $courses=DB::table('courses')->whereIn('slug',$slugs)->where('status','published')->get();
        abort_if($courses->count()!==count($slugs),422,'One or more selected courses are unavailable.');

        $code=strtoupper(trim($data['coupon_code']));
        abort_if($code==='',422,'Enter a coupon code.');

        $coupon=DB::table('coupons')->where('code',$code)->first();
        abort_unless($coupon&&$coupon->active,422,'Coupon is invalid or inactive.');

        $now=now();
        abort_if($coupon->starts_at&&$now->lt($coupon->starts_at),422,'Coupon is not active yet.');
        abort_if($coupon->ends_at&&$now->gt($coupon->ends_at),422,'Coupon has expired.');
        abort_if($coupon->max_uses!==null&&(int)$coupon->uses>=(int)$coupon->max_uses,422,'Coupon usage limit has been reached.');

        $subtotal=(int)$courses->sum('price');
        $base=$subtotal;
        $appliesTo='Entire order';

        if($coupon->course_id){
            $target=$courses->firstWhere('id',$coupon->course_id);
            abort_unless($target,422,'Coupon does not apply to the selected course(s).');
            $base=(int)$target->price;
            $appliesTo=$target->title;
        }

        $discountTotal=$coupon->discount_type==='fixed'
            ? min($base,(int)$coupon->discount_value)
            : (int)round($base*min(100,(int)$coupon->discount_value)/100);

        return response()->json([
            'ok'=>true,
            'coupon'=>[
                'code'=>$coupon->code,
                'discount_type'=>$coupon->discount_type,
                'discount_value'=>(int)$coupon->discount_value,
                'applies_to'=>$appliesTo,
            ],
            'subtotal'=>$subtotal,
            'discount_total'=>$discountTotal,
            'total'=>max(0,$subtotal-$discountTotal),
        ]);
    }
}
