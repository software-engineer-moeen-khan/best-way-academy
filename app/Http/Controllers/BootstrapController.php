<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BootstrapController extends Controller
{
    private function courseArray(object $c): array
    {
        $meta=is_string($c->metadata)?json_decode($c->metadata,true):($c->metadata??[]);
        return [
            'id'=>$c->id,'slug'=>$c->slug,'title'=>$c->title,'category'=>$c->category,'subtitle'=>$c->subtitle,
            'description'=>$c->description,'price'=>(int)$c->price,'priceLabel'=>'Rs '.number_format((int)$c->price),
            'status'=>$c->status,'rating'=>(float)$c->rating,'students'=>number_format((int)$c->students_count),
            'image'=>$c->image,'badge'=>$c->badge,'learn'=>$meta['learn']??[],'modules'=>$meta['modules']??[],
        ];
    }

    private function curriculum(int $courseId): array
    {
        return DB::table('course_sections')->where('course_id',$courseId)->orderBy('position')->get()->map(function($section){
            return [
                'title'=>$section->title,
                'lectures'=>DB::table('lessons')->where('course_section_id',$section->id)->orderBy('position')->get()->map(fn($lesson)=>[
                    'id'=>$lesson->id,'title'=>$lesson->title,'content'=>$lesson->content,'video_url'=>$lesson->video_url,
                    'duration_seconds'=>$lesson->duration_seconds,'is_preview'=>(bool)$lesson->is_preview,
                ])->values()->all(),
            ];
        })->values()->all();
    }

    private function enrollments(int $userId): array
    {
        return DB::table('enrollments as e')->join('courses as c','c.id','=','e.course_id')
            ->where('e.user_id',$userId)->orderByDesc('e.updated_at')
            ->select('e.progress','e.enrolled_at','e.completed_at','e.created_at','c.slug','c.title')
            ->get()->map(fn($e)=>['id'=>$e->slug,'date'=>$e->enrolled_at?:$e->created_at,'progress'=>(int)$e->progress,'completed_at'=>$e->completed_at,'title'=>$e->title])->values()->all();
    }

    private function playerStates(int $userId): array
    {
        $states=[];
        $enrollments=DB::table('enrollments as e')->join('courses as c','c.id','=','e.course_id')
            ->where('e.user_id',$userId)->select('e.course_id','c.slug')->get();
        foreach($enrollments as $enrollment){
            $lessonIds=DB::table('lessons as l')->join('course_sections as s','s.id','=','l.course_section_id')
                ->where('s.course_id',$enrollment->course_id)->orderBy('s.position')->orderBy('l.position')->pluck('l.id')->values();
            $doneIds=$lessonIds->isEmpty()?collect():DB::table('lesson_progress')->where('user_id',$userId)->whereIn('lesson_id',$lessonIds)->pluck('lesson_id');
            $doneLookup=array_fill_keys($doneIds->map(fn($id)=>(string)$id)->all(),true);
            $completed=[];
            foreach($lessonIds as $index=>$lessonId)if(isset($doneLookup[(string)$lessonId]))$completed[]=$index;
            $current=0;
            if($lessonIds->isNotEmpty()){
                $current=count($completed)>=count($lessonIds)?max(0,count($lessonIds)-1):0;
                if(count($completed)<count($lessonIds)){
                    for($i=0;$i<count($lessonIds);$i++){if(!in_array($i,$completed,true)){$current=$i;break;}}
                }
            }
            $states[$enrollment->slug]=['completed'=>$completed,'current'=>$current];
        }
        return $states;
    }

    private function orders(int $userId): array
    {
        $orders=DB::table('orders')->where('user_id',$userId)->latest('created_at')->limit(100)->get();
        if($orders->isEmpty())return [];
        $items=DB::table('order_items as oi')->join('courses as c','c.id','=','oi.course_id')->whereIn('oi.order_id',$orders->pluck('id'))->select('oi.order_id','c.slug')->get()->groupBy('order_id');
        return $orders->map(function($o)use($items){
            $meta=is_string($o->metadata)?json_decode($o->metadata,true):($o->metadata??[]);
            return ['number'=>$o->number,'total'=>(int)$o->total,'date'=>$o->created_at,'status'=>$o->status,'payment_method'=>$o->payment_method,'ids'=>($items[$o->id]??collect())->pluck('slug')->values()->all(),'originalTotal'=>(int)($meta['subtotal']??$o->total),'discount'=>isset($meta['coupon_code'])&&$meta['coupon_code']?['code'=>$meta['coupon_code'],'amount'=>(int)($meta['discount_total']??0)]:null];
        })->values()->all();
    }

    public function __invoke(Request $request): JsonResponse
    {
        $user=$request->user();
        $enrolledIds=DB::table('enrollments')->where('user_id',$user->id)->pluck('course_id');

        $query=DB::table('courses')->orderBy('id');
        if($user->role==='student')$query->where('status','published');
        elseif($user->role==='instructor')$query->where(function($q)use($user){$q->where('status','published')->orWhere('instructor_id',$user->id);});
        $rows=$query->get();

        $courses=[];$curricula=[];$accessibleIds=[];
        foreach($rows as $course){
            $courses[$course->slug]=$this->courseArray($course);
            $canManage=$user->role==='admin'||($user->role==='instructor'&&(int)$course->instructor_id===(int)$user->id);
            if($canManage||$enrolledIds->contains($course->id)){
                $curricula[$course->slug]=$this->curriculum((int)$course->id);
                $accessibleIds[]=$course->id;
            }
        }

        $states=DB::table('user_states')->where('user_id',$user->id)->pluck('value','key')->map(fn($v)=>json_decode($v,true));
        $globals=$user->role==='admin'?DB::table('global_states')->pluck('value','key')->map(fn($v)=>json_decode($v,true)):collect();

        $announcements=[];
        if($accessibleIds){
            $byId=$rows->keyBy('id');
            DB::table('announcements')->whereIn('course_id',$accessibleIds)->latest('created_at')->get()->groupBy('course_id')->each(function($list,$courseId)use(&$announcements,$byId){
                $course=$byId->get($courseId);if(!$course)return;
                $announcements[$course->slug]=$list->map(fn($a)=>['title'=>$a->title,'text'=>$a->body,'date'=>$a->created_at])->values()->all();
            });
        }

        $coupons=[];
        if(in_array($user->role,['admin','instructor'],true)){
            $couponQuery=DB::table('coupons')->where('active',true)->orderByDesc('created_at');
            if($user->role==='instructor'){
                $owned=DB::table('courses')->where('instructor_id',$user->id)->pluck('id');
                $couponQuery->whereIn('course_id',$owned);
            }
            $slugs=DB::table('courses')->pluck('slug','id');
            $coupons=$couponQuery->get()->map(fn($c)=>['code'=>$c->code,'discount'=>(int)$c->discount_value,'course'=>$c->course_id?($slugs[$c->course_id]??'all'):'all','active'=>(bool)$c->active,'date'=>$c->created_at])->values()->all();
        }

        return response()->json([
            'user'=>$user->only(['id','name','email','role']),
            'courses'=>$courses,'curricula'=>$curricula,'announcements'=>$announcements,'coupons'=>$coupons,
            'states'=>$states,'global_states'=>$globals,'enrollments'=>$this->enrollments($user->id),'player_states'=>$this->playerStates($user->id),'orders'=>$this->orders($user->id),
            'csrf_token'=>csrf_token(),
        ]);
    }
}
