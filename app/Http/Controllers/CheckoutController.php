<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CheckoutController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $data=$request->validate([
            'course_slugs'=>['required','array','min:1','max:50'],
            'course_slugs.*'=>['required','string','max:120'],
            'payment_method'=>['nullable','string','in:easypaisa'],
            'coupon_code'=>['required','string','max:80'],
        ]);

        $slugs=array_values(array_unique(array_filter(array_map(fn($v)=>trim((string)$v),$data['course_slugs']))));
        $courses=DB::table('courses')->whereIn('slug',$slugs)->where('status','published')->get();
        abort_if($courses->count()!==count($slugs),422,'One or more selected courses are unavailable.');

        $user=$request->user();
        $already=DB::table('enrollments as e')->join('courses as c','c.id','=','e.course_id')
            ->where('e.user_id',$user->id)->whereIn('c.slug',$slugs)->pluck('c.slug');
        abort_if($already->isNotEmpty(),422,'You are already enrolled in: '.$already->implode(', '));

        $result=DB::transaction(function()use($courses,$user,$data){
            $subtotal=(int)$courses->sum('price');
            $code=strtoupper(trim($data['coupon_code']));
            $coupon=DB::table('coupons')->where('code',$code)->lockForUpdate()->first();
            abort_unless($coupon&&$coupon->active,422,'Coupon is invalid or inactive.');
            $now=now();
            abort_if($coupon->starts_at&&$now->lt($coupon->starts_at),422,'Coupon is not active yet.');
            abort_if($coupon->ends_at&&$now->gt($coupon->ends_at),422,'Coupon has expired.');
            abort_if($coupon->max_uses!==null&&(int)$coupon->uses>=(int)$coupon->max_uses,422,'Coupon usage limit has been reached.');

            $base=$subtotal;
            if($coupon->course_id){
                $target=$courses->firstWhere('id',$coupon->course_id);
                abort_unless($target,422,'Coupon does not apply to this order.');
                $base=(int)$target->price;
            }
            $discount=$coupon->discount_type==='fixed'
                ? min($base,(int)$coupon->discount_value)
                : (int)round($base*min(100,(int)$coupon->discount_value)/100);
            $total=max(0,$subtotal-$discount);

            // Paid orders must always use /api/checkout/easypaisa and remain pending until verified.
            abort_if($total>0,422,'Paid enrollment must be submitted through EasyPaisa QR payment.');

            $number='BWA-'.strtoupper(Str::random(10));
            $meta=[
                'source'=>'web','subtotal'=>$subtotal,'discount_total'=>$discount,'coupon_code'=>$coupon->code,
                'payment_channel'=>'coupon_free','enrollment_granted'=>true,'coupon_counted'=>true,
            ];
            $orderId=DB::table('orders')->insertGetId([
                'user_id'=>$user->id,'number'=>$number,'total'=>0,'status'=>'completed','payment_method'=>'easypaisa',
                'metadata'=>json_encode($meta,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),
                'created_at'=>now(),'updated_at'=>now(),
            ]);

            foreach($courses as $course){
                DB::table('order_items')->insert([
                    'order_id'=>$orderId,'course_id'=>$course->id,'price'=>$course->price,
                    'created_at'=>now(),'updated_at'=>now(),
                ]);
                $inserted=DB::table('enrollments')->insertOrIgnore([
                    'user_id'=>$user->id,'course_id'=>$course->id,'progress'=>0,'enrolled_at'=>now(),
                    'created_at'=>now(),'updated_at'=>now(),
                ]);
                if(!$inserted)throw ValidationException::withMessages(['course_slugs'=>'One of these courses is already enrolled.']);
                DB::table('courses')->where('id',$course->id)->increment('students_count');
            }
            DB::table('coupons')->where('id',$coupon->id)->increment('uses');

            return compact('orderId','subtotal','discount');
        });

        $order=DB::table('orders')->where('id',$result['orderId'])->first();
        $enrollments=DB::table('enrollments as e')->join('courses as c','c.id','=','e.course_id')
            ->where('e.user_id',$user->id)->orderByDesc('e.updated_at')
            ->select('e.progress','e.enrolled_at','e.created_at','c.slug as id','c.title')->get();

        return response()->json([
            'order'=>$order,'subtotal'=>$result['subtotal'],'discount_total'=>$result['discount'],
            'coupon_code'=>$data['coupon_code'],'enrollments'=>$enrollments,
        ],201);
    }
}
