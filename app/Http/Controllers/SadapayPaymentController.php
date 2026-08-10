<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class SadapayPaymentController extends Controller
{
    private const QR_KEY='sadapay_qr';
    private const ACCOUNT_NAME='Muhammad Hamid Khan';
    private const ACCOUNT_NUMBER='03104720458';

    public function config(): JsonResponse
    {
        return response()->json([
            'enabled'=>true,
            'qr_url'=>'/api/payment/sadapay/qr',
            'method'=>'sadapay',
            'label'=>'SadaPay',
            'account_name'=>self::ACCOUNT_NAME,
            'account_number'=>self::ACCOUNT_NUMBER,
        ])->header('Cache-Control','no-store, no-cache, must-revalidate');
    }

    public function qr()
    {
        if(Schema::hasTable('payment_assets')){
            $asset=DB::table('payment_assets')->where('key',self::QR_KEY)->first();
            if($asset){
                $content=base64_decode((string)$asset->content_base64,true);
                abort_unless($content!==false&&$content!=='',404,'SadaPay payment QR is invalid.');
                return response($content,200,[
                    'Content-Type'=>$asset->mime_type?:'image/png',
                    'Content-Length'=>(string)strlen($content),
                    'Cache-Control'=>'private, no-cache, max-age=0, must-revalidate',
                    'X-Content-Type-Options'=>'nosniff',
                    'Content-Disposition'=>'inline; filename="sadapay-qr"',
                ]);
            }
        }

        $fallback=base_path('assets/sadapay-account-qr.svg');
        abort_unless(is_file($fallback),404,'SadaPay QR is not available.');
        return response()->file($fallback,[
            'Content-Type'=>'image/svg+xml; charset=UTF-8',
            'Cache-Control'=>'private, no-cache, max-age=0, must-revalidate',
            'X-Content-Type-Options'=>'nosniff',
        ]);
    }

    public function uploadQr(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);
        abort_unless(Schema::hasTable('payment_assets'),503,'Payment storage is not ready. Please run the latest database migrations.');
        $request->validate(['qr'=>['required','file','image','mimes:jpeg,jpg,png,webp','max:3072']]);
        $file=$request->file('qr');
        abort_unless($file&&$file->isValid(),422,'The selected QR image could not be uploaded.');
        $content=file_get_contents($file->getRealPath());
        abort_unless($content!==false&&strlen($content)>0,422,'The selected QR image is empty or unreadable.');
        $mime=(string)($file->getMimeType()?:'');
        abort_unless(in_array($mime,['image/jpeg','image/png','image/webp'],true),422,'QR image must be JPG, PNG or WebP.');
        $values=[
            'mime_type'=>$mime,'original_name'=>Str::limit((string)$file->getClientOriginalName(),255,''),
            'size_bytes'=>strlen($content),'content_base64'=>base64_encode($content),'updated_at'=>now(),
        ];
        if(DB::table('payment_assets')->where('key',self::QR_KEY)->exists())DB::table('payment_assets')->where('key',self::QR_KEY)->update($values);
        else DB::table('payment_assets')->insert(['key'=>self::QR_KEY,'created_at'=>now(),...$values]);
        return response()->json(['ok'=>true,'enabled'=>true,'qr_url'=>'/api/payment/sadapay/qr?rev='.now()->timestamp]);
    }

    public function removeQr(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);
        if(Schema::hasTable('payment_assets'))DB::table('payment_assets')->where('key',self::QR_KEY)->delete();
        return response()->json(['ok'=>true,'enabled'=>true,'qr_url'=>'/api/payment/sadapay/qr']);
    }

    public function submit(Request $request): JsonResponse
    {
        $data=$request->validate([
            'course_slugs'=>['required','array','min:1','max:50'],
            'course_slugs.*'=>['required','string','max:120'],
            'coupon_code'=>['nullable','string','max:80'],
            'payment_reference'=>['required','string','min:4','max:120'],
        ]);
        $slugs=array_values(array_unique(array_filter(array_map(fn($v)=>trim((string)$v),$data['course_slugs']))));
        $courses=DB::table('courses')->whereIn('slug',$slugs)->where('status','published')->get();
        abort_if($courses->count()!==count($slugs),422,'One or more selected courses are unavailable.');
        $user=$request->user();
        $already=DB::table('enrollments as e')->join('courses as c','c.id','=','e.course_id')->where('e.user_id',$user->id)->whereIn('c.slug',$slugs)->pluck('c.slug');
        abort_if($already->isNotEmpty(),422,'You are already enrolled in: '.$already->implode(', '));
        $reference=trim($data['payment_reference']);
        abort_unless((bool)preg_match('/^[A-Za-z0-9._\-\/ ]{4,120}$/',$reference),422,'Enter a valid SadaPay transaction/reference ID.');

        $result=DB::transaction(function()use($courses,$user,$data,$reference){
            $subtotal=(int)$courses->sum('price');$discount=0;$coupon=null;$code='';
            if(!empty($data['coupon_code'])){
                $code=strtoupper(trim((string)$data['coupon_code']));
                $coupon=DB::table('coupons')->where('code',$code)->lockForUpdate()->first();
                abort_unless($coupon&&$coupon->active,422,'Coupon is invalid or inactive.');
                $now=now();
                abort_if($coupon->starts_at&&$now->lt($coupon->starts_at),422,'Coupon is not active yet.');
                abort_if($coupon->ends_at&&$now->gt($coupon->ends_at),422,'Coupon has expired.');
                abort_if($coupon->max_uses!==null&&(int)$coupon->uses>=(int)$coupon->max_uses,422,'Coupon usage limit has been reached.');
                $base=$subtotal;
                if($coupon->course_id){$target=$courses->firstWhere('id',$coupon->course_id);abort_unless($target,422,'Coupon does not apply to this order.');$base=(int)$target->price;}
                $discount=$coupon->discount_type==='fixed'?min($base,(int)$coupon->discount_value):(int)round($base*min(100,(int)$coupon->discount_value)/100);
            }
            $total=max(0,$subtotal-$discount);
            $duplicate=DB::table('orders')->where('user_id',$user->id)->where('payment_method','sadapay')->whereIn('status',['pending','completed'])->where('metadata','like','%'.str_replace(['%','_'],['\\%','\\_'],$reference).'%')->exists();
            abort_if($duplicate,422,'This SadaPay reference has already been submitted.');
            $status=$total===0?'completed':'pending';
            $meta=[
                'source'=>'web','subtotal'=>$subtotal,'discount_total'=>$discount,'coupon_code'=>$code?:null,
                'payment_channel'=>'sadapay','payment_reference'=>$reference,'account_name'=>self::ACCOUNT_NAME,
                'account_number'=>self::ACCOUNT_NUMBER,'payment_submitted_at'=>now()->toIso8601String(),
                'enrollment_granted'=>false,'coupon_counted'=>false,
            ];
            $number='AWK-'.strtoupper(Str::random(10));
            $orderId=DB::table('orders')->insertGetId([
                'user_id'=>$user->id,'number'=>$number,'total'=>$total,'status'=>$status,'payment_method'=>'sadapay',
                'metadata'=>json_encode($meta,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),'created_at'=>now(),'updated_at'=>now(),
            ]);
            foreach($courses as $course)DB::table('order_items')->insert(['order_id'=>$orderId,'course_id'=>$course->id,'price'=>$course->price,'created_at'=>now(),'updated_at'=>now()]);
            if($total===0){
                foreach($courses as $course){$inserted=DB::table('enrollments')->insertOrIgnore(['user_id'=>$user->id,'course_id'=>$course->id,'progress'=>0,'enrolled_at'=>now(),'created_at'=>now(),'updated_at'=>now()]);if($inserted)DB::table('courses')->where('id',$course->id)->increment('students_count');}
                if($coupon){DB::table('coupons')->where('id',$coupon->id)->increment('uses');$meta['coupon_counted']=true;}
                $meta['enrollment_granted']=true;
                DB::table('orders')->where('id',$orderId)->update(['metadata'=>json_encode($meta,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),'updated_at'=>now()]);
            }
            return compact('orderId','subtotal','discount','total','status','code');
        });
        $order=DB::table('orders')->where('id',$result['orderId'])->first();
        return response()->json(['order'=>$order,'subtotal'=>$result['subtotal'],'discount_total'=>$result['discount'],'coupon_code'=>$result['code']?:null,'total'=>$result['total'],'status'=>$result['status'],'payment_pending'=>$result['status']==='pending'],201);
    }
}
