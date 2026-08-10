<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MessageCenterController extends Controller
{
    private const CHANNELS = ['instructor','support'];

    private function admin(Request $request): object
    {
        $user=$request->user();
        abort_unless($user?->role==='admin',403);
        return $user;
    }

    private function adminIdFor(int $userId,string $channel): int
    {
        $existing=DB::table('messages as m')
            ->join('users as u','u.id','=','m.sender_id')
            ->where('m.recipient_id',$userId)
            ->where('u.role','admin')
            ->when(Schema::hasColumn('messages','channel'),fn($q)=>$q->where('m.channel',$channel))
            ->latest('m.created_at')
            ->value('m.sender_id');

        if($existing)return (int)$existing;

        $query=DB::table('users')->where('role','admin');
        if(Schema::hasColumn('users','status'))$query->where('status','active');
        $id=$query->orderBy('id')->value('id');
        abort_unless($id,503,'No active administrator is available for messages.');
        return (int)$id;
    }

    public function userIndex(Request $request): JsonResponse
    {
        $user=$request->user();
        $hasChannel=Schema::hasColumn('messages','channel');
        $columns=['m.id','m.sender_id','m.recipient_id','m.subject','m.body','m.read_at','m.created_at','s.name as sender_name','s.role as sender_role','r.name as recipient_name','r.role as recipient_role'];
        if($hasChannel)$columns[]='m.channel';

        $rows=DB::table('messages as m')
            ->join('users as s','s.id','=','m.sender_id')
            ->join('users as r','r.id','=','m.recipient_id')
            ->where(function($q)use($user){
                $q->where(function($x)use($user){$x->where('m.sender_id',$user->id)->where('r.role','admin');})
                  ->orWhere(function($x)use($user){$x->where('m.recipient_id',$user->id)->where('s.role','admin');});
            })
            ->when($hasChannel,fn($q)=>$q->whereIn('m.channel',self::CHANNELS))
            ->orderBy('m.created_at')
            ->limit(300)
            ->select($columns)
            ->get()
            ->map(function($row)use($user,$hasChannel){
                $channel=$hasChannel?($row->channel?:'support'):'support';
                return [
                    'id'=>(int)$row->id,
                    'channel'=>in_array($channel,self::CHANNELS,true)?$channel:'support',
                    'subject'=>$row->subject,
                    'body'=>$row->body,
                    'created_at'=>$row->created_at,
                    'read_at'=>$row->read_at,
                    'mine'=>(int)$row->sender_id===(int)$user->id,
                    'sender_name'=>$row->sender_name,
                ];
            })->values();

        DB::table('messages')->where('recipient_id',$user->id)->whereNull('read_at')
            ->when($hasChannel,fn($q)=>$q->whereIn('channel',self::CHANNELS))
            ->update(['read_at'=>now(),'updated_at'=>now()]);

        return response()->json(['messages'=>$rows])->header('Cache-Control','no-store, no-cache, must-revalidate');
    }

    public function userSend(Request $request): JsonResponse
    {
        $data=$request->validate([
            'channel'=>['required','string','in:instructor,support'],
            'subject'=>['nullable','string','max:180'],
            'body'=>['required','string','max:5000'],
        ]);

        $adminId=$this->adminIdFor((int)$request->user()->id,$data['channel']);
        $row=[
            'sender_id'=>$request->user()->id,
            'recipient_id'=>$adminId,
            'subject'=>$data['subject']??($data['channel']==='instructor'?'Instructor message':'Support message'),
            'body'=>trim($data['body']),
            'created_at'=>now(),
            'updated_at'=>now(),
        ];
        if(Schema::hasColumn('messages','channel'))$row['channel']=$data['channel'];
        $id=DB::table('messages')->insertGetId($row);

        return response()->json(['ok'=>true,'id'=>$id,'channel'=>$data['channel']],201);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $admin=$this->admin($request);
        $hasChannel=Schema::hasColumn('messages','channel');
        $columns=['m.id','m.sender_id','m.recipient_id','m.subject','m.body','m.read_at','m.created_at','s.name as sender_name','s.email as sender_email','s.role as sender_role','r.name as recipient_name','r.role as recipient_role'];
        if($hasChannel)$columns[]='m.channel';

        $internal=DB::table('messages as m')
            ->join('users as s','s.id','=','m.sender_id')
            ->join('users as r','r.id','=','m.recipient_id')
            ->where(function($q)use($hasChannel){
                if($hasChannel)$q->whereIn('m.channel',self::CHANNELS);
                $q->orWhere(function($x){$x->where('s.role','instructor')->where('r.role','admin');});
            })
            ->latest('m.created_at')
            ->limit(400)
            ->select($columns)
            ->get()
            ->map(function($row)use($hasChannel){
                $channel=$hasChannel?($row->channel?:($row->sender_role==='instructor'?'instructor':'support')):($row->sender_role==='instructor'?'instructor':'support');
                $fromAdmin=$row->sender_role==='admin';
                $otherId=$fromAdmin?(int)$row->recipient_id:(int)$row->sender_id;
                $otherName=$fromAdmin?$row->recipient_name:$row->sender_name;
                $otherEmail=$fromAdmin?null:$row->sender_email;
                return [
                    'source'=>'message','id'=>(int)$row->id,'channel'=>$channel,'subject'=>$row->subject,'body'=>$row->body,
                    'created_at'=>$row->created_at,'read_at'=>$row->read_at,'from_admin'=>$fromAdmin,
                    'user_id'=>$otherId,'sender_name'=>$otherName,'sender_email'=>$otherEmail,
                ];
            })->values();

        $support=DB::table('support_requests')->latest('created_at')->limit(300)->get()->map(fn($row)=>[
            'source'=>'contact','id'=>(int)$row->id,'channel'=>'support','subject'=>$row->subject,'body'=>$row->message,
            'created_at'=>$row->created_at,'read_at'=>null,'from_admin'=>false,'user_id'=>$row->user_id,
            'sender_name'=>$row->name,'sender_email'=>$row->email,'status'=>$row->status,
        ])->values();

        DB::table('messages')->where('recipient_id',$admin->id)->whereNull('read_at')
            ->when($hasChannel,fn($q)=>$q->whereIn('channel',self::CHANNELS))
            ->update(['read_at'=>now(),'updated_at'=>now()]);

        return response()->json([
            'messages'=>$internal,
            'support_requests'=>$support,
            'counts'=>[
                'internal'=>$internal->count(),
                'support'=>$support->count(),
                'unread'=>$internal->where('from_admin',false)->whereNull('read_at')->count(),
            ],
        ])->header('Cache-Control','no-store, no-cache, must-revalidate');
    }

    public function adminReply(Request $request,int $user): JsonResponse
    {
        $admin=$this->admin($request);
        $target=DB::table('users')->where('id',$user)->first();
        abort_unless($target&&$target->role!=='admin',404,'Recipient not found.');
        $data=$request->validate([
            'channel'=>['required','string','in:instructor,support'],
            'subject'=>['nullable','string','max:180'],
            'body'=>['required','string','max:5000'],
        ]);

        $row=[
            'sender_id'=>$admin->id,'recipient_id'=>$target->id,
            'subject'=>$data['subject']??($data['channel']==='instructor'?'Instructor reply':'Support reply'),
            'body'=>trim($data['body']),'created_at'=>now(),'updated_at'=>now(),
        ];
        if(Schema::hasColumn('messages','channel'))$row['channel']=$data['channel'];
        $id=DB::table('messages')->insertGetId($row);
        return response()->json(['ok'=>true,'id'=>$id],201);
    }
}
