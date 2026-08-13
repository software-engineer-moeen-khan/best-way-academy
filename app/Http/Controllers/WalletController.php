<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class WalletController extends Controller
{
    private const QR_KEY='jazzcash_wallet_qr';
    private const BANK='JazzCash';
    private const ACCOUNT_TITLE='Moeen Khan';
    private const ACCOUNT_NUMBER='03114408852';
    private const MAX_AMOUNT=10000000;

    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'deposit'=>[
                'bank'=>self::BANK,
                'account_title'=>self::ACCOUNT_TITLE,
                'account_number'=>self::ACCOUNT_NUMBER,
                'qr_url'=>'/api/wallet/deposit-qr',
            ],
            'requests'=>DB::table('wallet_requests')->where('user_id',$request->user()->id)->orderByDesc('id')->limit(80)->get()->map(fn($r)=>$this->payload($r)),
            'notice'=>'This module records manual payment requests only. It is separate from Flight Lab practice credits.',
        ])->header('Cache-Control','no-store, no-cache, must-revalidate');
    }

    public function qr(Request $request)
    {
        if(Schema::hasTable('payment_assets')){
            $asset=DB::table('payment_assets')->where('key',self::QR_KEY)->first();
            if($asset){
                $content=base64_decode((string)$asset->content_base64,true);
                abort_unless($content!==false&&$content!=='',404,'JazzCash QR is invalid.');
                return response($content,200,[
                    'Content-Type'=>$asset->mime_type?:'image/png',
                    'Content-Length'=>(string)strlen($content),
                    'Cache-Control'=>'private, no-cache, max-age=0, must-revalidate',
                    'X-Content-Type-Options'=>'nosniff',
                ]);
            }
        }
        $svg='<svg xmlns="http://www.w3.org/2000/svg" width="520" height="520" viewBox="0 0 520 520"><rect width="520" height="520" rx="28" fill="#fff"/><rect x="20" y="20" width="480" height="480" rx="22" fill="none" stroke="#ddd" stroke-width="4"/><text x="260" y="205" text-anchor="middle" font-family="Arial" font-size="34" font-weight="700">JazzCash</text><text x="260" y="255" text-anchor="middle" font-family="Arial" font-size="24">Moeen Khan</text><text x="260" y="295" text-anchor="middle" font-family="Arial" font-size="28" font-weight="700">03114408852</text><text x="260" y="355" text-anchor="middle" font-family="Arial" font-size="18" fill="#666">Admin has not uploaded the QR image yet.</text></svg>';
        return response($svg,200,['Content-Type'=>'image/svg+xml; charset=UTF-8','Cache-Control'=>'no-store']);
    }

    public function deposit(Request $request): JsonResponse
    {
        $data=$request->validate([
            'amount'=>['required','numeric','min:1','max:'.self::MAX_AMOUNT],
            'payment_reference'=>['required','string','min:4','max:160'],
            'proof'=>['required','file','image','mimes:jpeg,jpg,png,webp','max:3072'],
        ]);
        $reference=trim((string)$data['payment_reference']);
        abort_unless((bool)preg_match('/^[A-Za-z0-9._\-\/ ]{4,160}$/',$reference),422,'Enter a valid payment reference.');
        abort_if(DB::table('wallet_requests')->where('type','deposit')->where('payment_reference',$reference)->whereIn('status',['pending','approved'])->exists(),422,'This payment reference has already been submitted.');
        $file=$request->file('proof');
        abort_unless($file&&$file->isValid(),422,'The payment proof could not be uploaded.');
        $content=file_get_contents($file->getRealPath());
        abort_unless($content!==false&&strlen($content)>0,422,'The payment proof is empty or unreadable.');
        $mime=(string)($file->getMimeType()?:'');
        abort_unless(in_array($mime,['image/jpeg','image/png','image/webp'],true),422,'Proof must be JPG, PNG or WebP.');
        $amount=round((float)$data['amount'],2);$user=$request->user();
        $id=DB::table('wallet_requests')->insertGetId([
            'public_id'=>(string)Str::uuid(),'user_id'=>$user->id,'type'=>'deposit','amount'=>$amount,'status'=>'pending',
            'provider'=>'jazzcash','account_title'=>self::ACCOUNT_TITLE,'account_number'=>self::ACCOUNT_NUMBER,
            'payment_reference'=>$reference,'proof_mime'=>$mime,'proof_name'=>Str::limit((string)$file->getClientOriginalName(),255,''),
            'proof_size'=>strlen($content),'proof_base64'=>base64_encode($content),'created_at'=>now(),'updated_at'=>now(),
        ]);
        $this->audit($request,'deposit_request_submitted',(int)$user->id,$id,['amount'=>$amount,'payment_reference'=>$reference]);
        return response()->json(['ok'=>true,'message'=>'Deposit request submitted for manual review.','request'=>$this->payload(DB::table('wallet_requests')->where('id',$id)->first())],201);
    }

    public function withdrawal(Request $request): JsonResponse
    {
        $data=$request->validate([
            'amount'=>['required','numeric','min:1','max:'.self::MAX_AMOUNT],
            'provider'=>['required','string','in:jazzcash,easypaisa,bank'],
            'account_title'=>['required','string','min:2','max:190'],
            'account_number'=>['required','string','min:5','max:120'],
        ]);
        $user=$request->user();$amount=round((float)$data['amount'],2);
        $id=DB::table('wallet_requests')->insertGetId([
            'public_id'=>(string)Str::uuid(),'user_id'=>$user->id,'type'=>'withdrawal','amount'=>$amount,'status'=>'pending',
            'provider'=>strtolower((string)$data['provider']),'account_title'=>trim((string)$data['account_title']),
            'account_number'=>trim((string)$data['account_number']),'created_at'=>now(),'updated_at'=>now(),
        ]);
        $this->audit($request,'withdrawal_request_submitted',(int)$user->id,$id,['amount'=>$amount,'provider'=>$data['provider']]);
        return response()->json(['ok'=>true,'message'=>'Withdrawal request submitted for manual review and payment.','request'=>$this->payload(DB::table('wallet_requests')->where('id',$id)->first())],201);
    }

    public function cancelWithdrawal(Request $request,int $walletRequest): JsonResponse
    {
        $item=DB::table('wallet_requests')->where('id',$walletRequest)->where('user_id',$request->user()->id)->where('type','withdrawal')->first();
        abort_unless($item,404);abort_unless($item->status==='pending',422,'Only pending withdrawal requests can be cancelled.');
        DB::table('wallet_requests')->where('id',$item->id)->update(['status'=>'cancelled','updated_at'=>now()]);
        $this->audit($request,'withdrawal_request_cancelled',(int)$request->user()->id,$item->id,['amount'=>(float)$item->amount]);
        return response()->json(['ok'=>true]);
    }

    public function proof(Request $request,int $walletRequest)
    {
        $item=DB::table('wallet_requests')->where('id',$walletRequest)->first();abort_unless($item,404);
        abort_unless($request->user()?->role==='admin'||(int)$item->user_id===(int)$request->user()?->id,403);
        $content=base64_decode((string)$item->proof_base64,true);abort_unless($content!==false&&$content!=='',404);
        return response($content,200,['Content-Type'=>$item->proof_mime?:'image/jpeg','Content-Length'=>(string)strlen($content),'Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $this->admin($request);
        $requests=DB::table('wallet_requests as r')->join('users as u','u.id','=','r.user_id')
            ->orderByRaw("CASE WHEN r.status='pending' THEN 0 ELSE 1 END")->orderByDesc('r.id')->limit(400)
            ->get(['r.*','u.name as user_name','u.email as user_email'])
            ->map(fn($r)=>$this->payload($r)+['user_name'=>$r->user_name,'user_email'=>$r->user_email]);
        return response()->json([
            'summary'=>[
                'pending'=>$requests->where('status','pending')->count(),
                'deposits'=>$requests->where('type','deposit')->count(),
                'withdrawals'=>$requests->where('type','withdrawal')->count(),
            ],
            'requests'=>$requests,
            'audit'=>DB::table('wallet_audit_logs')->orderByDesc('id')->limit(150)->get(),
        ])->header('Cache-Control','no-store');
    }

    public function adminReview(Request $request,int $walletRequest): JsonResponse
    {
        $this->admin($request);
        $data=$request->validate(['action'=>['required','string','in:approve,reject,paid'],'note'=>['nullable','string','max:2000']]);
        $item=DB::table('wallet_requests')->where('id',$walletRequest)->first();abort_unless($item,404);abort_unless($item->status==='pending',422,'This request has already been reviewed.');
        if($item->type==='deposit')abort_unless(in_array($data['action'],['approve','reject'],true),422,'Use approve or reject for a deposit.');
        else abort_unless(in_array($data['action'],['paid','reject'],true),422,'Use paid or reject for a withdrawal.');
        $status=match($data['action']){'approve'=>'approved','paid'=>'paid',default=>'rejected'};
        DB::table('wallet_requests')->where('id',$item->id)->update([
            'status'=>$status,'admin_note'=>trim((string)($data['note']??''))?:null,'reviewed_by'=>$request->user()->id,'reviewed_at'=>now(),'updated_at'=>now(),
        ]);
        $this->audit($request,'wallet_request_'.$status,(int)$item->user_id,$item->id,['type'=>$item->type,'amount'=>(float)$item->amount,'note'=>$data['note']??null]);
        return response()->json(['ok'=>true,'request'=>$this->payload(DB::table('wallet_requests')->where('id',$item->id)->first())]);
    }

    public function uploadQr(Request $request): JsonResponse
    {
        $this->admin($request);abort_unless(Schema::hasTable('payment_assets'),503,'Payment asset storage is not ready.');
        $request->validate(['qr'=>['required','file','image','mimes:jpeg,jpg,png,webp','max:3072']]);
        $file=$request->file('qr');abort_unless($file&&$file->isValid(),422);$content=file_get_contents($file->getRealPath());abort_unless($content!==false&&strlen($content)>0,422);
        $mime=(string)($file->getMimeType()?:'');abort_unless(in_array($mime,['image/jpeg','image/png','image/webp'],true),422);
        $values=['mime_type'=>$mime,'original_name'=>Str::limit((string)$file->getClientOriginalName(),255,''),'size_bytes'=>strlen($content),'content_base64'=>base64_encode($content),'updated_at'=>now()];
        if(DB::table('payment_assets')->where('key',self::QR_KEY)->exists())DB::table('payment_assets')->where('key',self::QR_KEY)->update($values);else DB::table('payment_assets')->insert(['key'=>self::QR_KEY,'created_at'=>now(),...$values]);
        $this->audit($request,'wallet_qr_updated');return response()->json(['ok'=>true,'qr_url'=>'/api/wallet/deposit-qr?rev='.now()->timestamp]);
    }

    public function removeQr(Request $request): JsonResponse
    {
        $this->admin($request);if(Schema::hasTable('payment_assets'))DB::table('payment_assets')->where('key',self::QR_KEY)->delete();$this->audit($request,'wallet_qr_removed');return response()->json(['ok'=>true]);
    }

    private function payload(object $r): array
    {
        return ['id'=>$r->id,'public_id'=>$r->public_id,'type'=>$r->type,'amount'=>(float)$r->amount,'status'=>$r->status,'provider'=>$r->provider,
            'account_title'=>$r->account_title,'account_number'=>$r->account_number,'payment_reference'=>$r->payment_reference,'admin_note'=>$r->admin_note,
            'proof_url'=>$r->proof_mime?'/api/wallet/requests/'.$r->id.'/proof':null,'reviewed_at'=>$r->reviewed_at,'created_at'=>$r->created_at];
    }
    private function audit(Request $request,string $action,?int $targetUserId=null,?int $requestId=null,?array $details=null): void
    {
        if(!Schema::hasTable('wallet_audit_logs'))return;
        DB::table('wallet_audit_logs')->insert(['actor_user_id'=>$request->user()?->id,'target_user_id'=>$targetUserId,'request_id'=>$requestId,'action'=>$action,
            'details'=>$details?json_encode($details,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE):null,'ip_address'=>$request->ip(),
            'user_agent'=>Str::limit((string)$request->userAgent(),500,''),'created_at'=>now()]);
    }
    private function admin(Request $request): void{abort_unless($request->user()?->role==='admin',403,'Administrator access is required.');}
}
