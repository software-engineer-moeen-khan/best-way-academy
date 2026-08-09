<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EasypaisaPaymentController extends Controller
{
    public function config(): JsonResponse
    {
        $path=$this->qrPath();
        return response()->json([
            'enabled'=>$path!==null,
            'qr_url'=>$path?'/api/payment/easypaisa/qr':null,
            'method'=>'easypaisa',
            'label'=>'EasyPaisa QR',
        ]);
    }

    public function qr()
    {
        $path=$this->qrPath();
        abort_unless($path,404,'EasyPaisa payment QR is not configured.');
        return Storage::disk('public')->response($path,null,[
            'Cache-Control'=>'private, max-age=300',
            'X-Content-Type-Options'=>'nosniff',
        ]);
    }

    public function uploadQr(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);
        $data=$request->validate([
            'qr'=>['required','image','mimes:jpeg,jpg,png,webp','max:5120'],
        ]);
        foreach(['jpg','jpeg','png','webp'] as $ext){
            Storage::disk('public')->delete('payments/easypaisa-qr.'.$ext);
        }
        $file=$data['qr'];
        $ext=strtolower($file->getClientOriginalExtension()?:'jpg');
        if($ext==='jpeg')$ext='jpg';
        $path=$file->storeAs('payments','easypaisa-qr.'.$ext,'public');
        abort_unless($path,500,'Payment QR could not be saved.');
        return response()->json(['ok'=>true,'qr_url'=>'/api/payment/easypaisa/qr']);
    }

    public function removeQr(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);
        foreach(['jpg','jpeg','png','webp'] as $ext){
            Storage::disk('public')->delete('payments/easypaisa-qr.'.$ext);
        }
        return response()->json(['ok'=>true]);
    }

    public function submit(Request $request): JsonResponse
    {
        $data=$request->validate([
            'course_slugs'=>['required','array','min:1','max:50'],
            'course_slugs.*'=>['required','string','max:120'],
            'coupon_code'=>['required','string','max:80'],
            'payment_reference'=>['required','string','min:4','max:120'],
        ]);

        abort_unless($this->qrPath(),422,'EasyPaisa QR payment is not configured yet.');
        $slugs=array_values(array_unique(array_filter(array_map(fn($v)=>trim((string)$v),$data['course_slugs']))));
        $courses=DB::table('courses')->whereIn('slug',$slugs)->where('status','published')->get();
        abort_if($courses->count()!==count($slugs),422,'One or more selected courses are unavailable.');

        $user=$request->user();
        $already=DB::table('enrollments as e')->join('courses as c','c.id','=','e.course_id')
            ->where('e.user_id',$user->id)->whereIn('c.slug',$slugs)->pluck('c.slug');
        abort_if($already->isNotEmpty(),422,'You are already enrolled in: '.$already->implode(', '));

        $reference=trim($data['payment_reference']);
        abort_unless((bool)preg_match('/^[A-Za-z0-9._\-\/ ]{4,120}$/',$reference),422,'Enter a valid EasyPaisa transaction/reference ID.');

        $result=DB::transaction(function()use($courses,$user,$data,$reference){
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

            $duplicate=DB::table('orders')->where('user_id',$user->id)->where('payment_method','easypaisa')
                ->whereIn('status',['pending','completed'])
                ->where('metadata','like','%'.str_replace(['%','_'],['\\%','\\_'],$reference).'%')->exists();
            abort_if($duplicate,422,'This EasyPaisa reference has already been submitted.');

            $status=$total===0?'completed':'pending';
            $meta=[
                'source'=>'web','subtotal'=>$subtotal,'discount_total'=>$discount,'coupon_code'=>$coupon->code,
                'payment_channel'=>'easypaisa_qr','payment_reference'=>$reference,
                'payment_submitted_at'=>now()->toIso8601String(),'enrollment_granted'=>false,'coupon_counted'=>false,
            ];
            $number='BWA-'.strtoupper(Str::random(10));
            $orderId=DB::table('orders')->insertGetId([
                'user_id'=>$user->id,'number'=>$number,'total'=>$total,'status'=>$status,
                'payment_method'=>'easypaisa','metadata'=>json_encode($meta,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),
                'created_at'=>now(),'updated_at'=>now(),
            ]);
            foreach($courses as $course){
                DB::table('order_items')->insert([
                    'order_id'=>$orderId,'course_id'=>$course->id,'price'=>$course->price,
                    'created_at'=>now(),'updated_at'=>now(),
                ]);
            }

            if($total===0){
                foreach($courses as $course){
                    $inserted=DB::table('enrollments')->insertOrIgnore([
                        'user_id'=>$user->id,'course_id'=>$course->id,'progress'=>0,'enrolled_at'=>now(),
                        'created_at'=>now(),'updated_at'=>now(),
                    ]);
                    if($inserted)DB::table('courses')->where('id',$course->id)->increment('students_count');
                }
                DB::table('coupons')->where('id',$coupon->id)->increment('uses');
                $meta['enrollment_granted']=true;$meta['coupon_counted']=true;
                DB::table('orders')->where('id',$orderId)->update(['metadata'=>json_encode($meta,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),'updated_at'=>now()]);
            }

            return compact('orderId','subtotal','discount','total','status');
        });

        $order=DB::table('orders')->where('id',$result['orderId'])->first();
        return response()->json([
            'order'=>$order,'subtotal'=>$result['subtotal'],'discount_total'=>$result['discount'],
            'total'=>$result['total'],'status'=>$result['status'],'payment_pending'=>$result['status']==='pending',
        ],201);
    }

    private function qrPath(): ?string
    {
        foreach(['jpg','jpeg','png','webp'] as $ext){
            $path='payments/easypaisa-qr.'.$ext;
            if(Storage::disk('public')->exists($path))return $path;
        }
        return null;
    }
}
