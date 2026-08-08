<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PlatformController extends Controller
{
    public function session(Request $request): JsonResponse
    {
        return response()->json([
            'authenticated' => Auth::check(),
            'csrf_token' => csrf_token(),
            'user' => $request->user()?->only(['id','name','email','role']),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $data=$request->validate([
            'name'=>['required','string','max:120'],
            'email'=>['required','email','max:190','unique:users,email'],
            'password'=>['required','string','min:8','max:200'],
        ]);
        $user=User::create([
            'name'=>trim($data['name']),
            'email'=>strtolower(trim($data['email'])),
            'password'=>Hash::make($data['password']),
            'role'=>'student',
        ]);
        Auth::login($user,true);
        $request->session()->regenerate();
        $redirect=$request->session()->pull('url.intended','/dashboard');
        return response()->json(['user'=>$user->only(['id','name','email','role']),'csrf_token'=>csrf_token(),'redirect'=>$redirect],201);
    }

    public function login(Request $request): JsonResponse
    {
        $data=$request->validate(['email'=>['required','email','max:190'],'password'=>['required','string','max:200']]);
        if(!Auth::attempt(['email'=>strtolower(trim($data['email'])),'password'=>$data['password']],true)){
            throw ValidationException::withMessages(['email'=>'The provided credentials are incorrect.']);
        }
        $request->session()->regenerate();
        $user=$request->user();
        $redirect=$request->session()->pull('url.intended','/dashboard');
        return response()->json(['user'=>$user->only(['id','name','email','role']),'csrf_token'=>csrf_token(),'redirect'=>$redirect]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->json(['ok'=>true,'csrf_token'=>csrf_token()]);
    }

    public function profile(Request $request): JsonResponse
    {
        $u=$request->user();
        $data=$request->validate([
            'name'=>['required','string','max:120'],
            'email'=>['required','email','max:190','unique:users,email,'.$u->id],
        ]);
        $u->update(['name'=>trim($data['name']),'email'=>strtolower(trim($data['email']))]);
        return response()->json(['user'=>$u->only(['id','name','email','role'])]);
    }

    private function isStaff(?User $user): bool
    {
        return $user && in_array($user->role,['admin','instructor'],true);
    }

    private function canManageCourse(?User $user, object $course): bool
    {
        if(!$user)return false;
        if($user->role==='admin')return true;
        return $user->role==='instructor' && (int)$course->instructor_id===(int)$user->id;
    }

    private function requireCourseAccess(Request $request, object $course): void
    {
        if($this->canManageCourse($request->user(),$course))return;
        $enrolled=DB::table('enrollments')->where('user_id',$request->user()->id)->where('course_id',$course->id)->exists();
        abort_unless($enrolled,403,'Enroll in this course first.');
    }

    private function encodeState(mixed $value): string
    {
        $json=json_encode($value,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
        if($json===false)throw ValidationException::withMessages(['value'=>'State value could not be encoded.']);
        if(strlen($json)>262144)throw ValidationException::withMessages(['value'=>'State value is too large.']);
        return $json;
    }

    private function legacyCourse(object $c): array
    {
        $meta=is_string($c->metadata)?json_decode($c->metadata,true):($c->metadata??[]);
        return [
            'id'=>$c->id,'slug'=>$c->slug,'title'=>$c->title,'category'=>$c->category,'subtitle'=>$c->subtitle,
            'description'=>$c->description,'price'=>(int)$c->price,'priceLabel'=>'Rs '.number_format((int)$c->price),
            'status'=>$c->status,'rating'=>(float)$c->rating,'students'=>number_format((int)$c->students_count),
            'image'=>$c->image,'badge'=>$c->badge,'learn'=>$meta['learn']??[],'modules'=>$meta['modules']??[],
        ];
    }

    private function courseCurriculum(int $courseId): array
    {
        return DB::table('course_sections')->where('course_id',$courseId)->orderBy('position')->get()->map(function($s){
            $lectures=DB::table('lessons')->where('course_section_id',$s->id)->orderBy('position')->get()->map(fn($l)=>[
                'id'=>$l->id,'title'=>$l->title,'content'=>$l->content,'video_url'=>$l->video_url,
                'duration_seconds'=>$l->duration_seconds,'is_preview'=>(bool)$l->is_preview,
            ])->values()->all();
            return ['title'=>$s->title,'lectures'=>$lectures];
        })->values()->all();
    }

    private function canonicalEnrollments(int $userId): array
    {
        return DB::table('enrollments as e')->join('courses as c','c.id','=','e.course_id')
            ->where('e.user_id',$userId)->orderByDesc('e.updated_at')
            ->select('e.progress','e.enrolled_at','e.completed_at','e.created_at','c.slug','c.title')
            ->get()->map(fn($e)=>[
                'id'=>$e->slug,'date'=>$e->enrolled_at?:$e->created_at,'progress'=>(int)$e->progress,
                'completed_at'=>$e->completed_at,'title'=>$e->title,
            ])->values()->all();
    }

    private function canonicalOrders(int $userId): array
    {
        $orders=DB::table('orders')->where('user_id',$userId)->latest('created_at')->limit(100)->get();
        if($orders->isEmpty())return [];
        $items=DB::table('order_items as oi')->join('courses as c','c.id','=','oi.course_id')
            ->whereIn('oi.order_id',$orders->pluck('id'))->select('oi.order_id','c.slug')->get()->groupBy('order_id');
        return $orders->map(function($o)use($items){
            $meta=is_string($o->metadata)?json_decode($o->metadata,true):($o->metadata??[]);
            return [
                'number'=>$o->number,'total'=>(int)$o->total,'date'=>$o->created_at,'status'=>$o->status,
                'payment_method'=>$o->payment_method,'ids'=>($items[$o->id]??collect())->pluck('slug')->values()->all(),
                'originalTotal'=>(int)($meta['subtotal']??$o->total),
                'discount'=>isset($meta['coupon_code'])&&$meta['coupon_code']?['code'=>$meta['coupon_code'],'amount'=>(int)($meta['discount_total']??0)]:null,
            ];
        })->values()->all();
    }

    public function courses(): JsonResponse
    {
        $rows=DB::table('courses')->where('status','published')->orderBy('id')->get()->map(fn($c)=>$this->legacyCourse($c));
        return response()->json($rows);
    }

    public function course(Request $request,string $slug): JsonResponse
    {
        $c=DB::table('courses')->where('slug',$slug)->first();
        abort_unless($c,404);
        if($c->status!=='published')abort_unless($this->canManageCourse($request->user(),$c),404);
        $out=$this->legacyCourse($c);
        $out['sections']=$this->courseCurriculum((int)$c->id);
        return response()->json($out);
    }

    public function bootstrap(Request $request): JsonResponse
    {
        $user=$request->user();
        $query=DB::table('courses')->orderBy('id');
        if($user->role==='student')$query->where('status','published');
        elseif($user->role==='instructor')$query->where(function($q)use($user){$q->where('status','published')->orWhere('instructor_id',$user->id);});
        $rows=$query->get();

        $courses=[];$curricula=[];
        foreach($rows as $c){
            $courses[$c->slug]=$this->legacyCourse($c);
            $curricula[$c->slug]=$this->courseCurriculum((int)$c->id);
        }

        $states=DB::table('user_states')->where('user_id',$user->id)->pluck('value','key')->map(fn($v)=>json_decode($v,true));
        $globals=collect();
        if($user->role==='admin')$globals=DB::table('global_states')->pluck('value','key')->map(fn($v)=>json_decode($v,true));

        $announcements=[];
        if($rows->isNotEmpty()){
            $byCourse=$rows->keyBy('id');
            DB::table('announcements')->whereIn('course_id',$rows->pluck('id'))->latest('created_at')->get()->groupBy('course_id')->each(function($list,$courseId)use(&$announcements,$byCourse){
                $course=$byCourse->get($courseId);if(!$course)return;
                $announcements[$course->slug]=$list->map(fn($a)=>['title'=>$a->title,'text'=>$a->body,'date'=>$a->created_at])->values()->all();
            });
        }

        $coupons=[];
        if($this->isStaff($user)){
            $couponQuery=DB::table('coupons')->where('active',true)->orderByDesc('created_at');
            if($user->role==='instructor'){
                $owned=DB::table('courses')->where('instructor_id',$user->id)->pluck('id');
                $couponQuery->whereIn('course_id',$owned);
            }
            $courseSlugs=DB::table('courses')->pluck('slug','id');
            $coupons=$couponQuery->get()->map(fn($c)=>[
                'code'=>$c->code,'discount'=>(int)$c->discount_value,'course'=>$c->course_id?($courseSlugs[$c->course_id]??'all'):'all',
                'active'=>(bool)$c->active,'date'=>$c->created_at,
            ])->values()->all();
        }

        return response()->json([
            'user'=>$user->only(['id','name','email','role']),
            'courses'=>$courses,'curricula'=>$curricula,'announcements'=>$announcements,'coupons'=>$coupons,
            'states'=>$states,'global_states'=>$globals,'enrollments'=>$this->canonicalEnrollments($user->id),
            'orders'=>$this->canonicalOrders($user->id),'csrf_token'=>csrf_token(),
        ]);
    }

    private function validateStateKey(string $key): void
    {
        abort_unless((bool)preg_match('/^bwa_[A-Za-z0-9_.:-]{1,120}$/',$key),422,'Invalid state key.');
    }

    public function putState(Request $request): JsonResponse
    {
        $data=$request->validate(['key'=>['required','string','max:128'],'value'=>['nullable']]);
        $this->validateStateKey($data['key']);
        $json=$this->encodeState($data['value']??null);
        DB::table('user_states')->updateOrInsert(['user_id'=>$request->user()->id,'key'=>$data['key']],['value'=>$json,'updated_at'=>now()]);
        return response()->json(['ok'=>true]);
    }

    public function deleteState(Request $request): JsonResponse
    {
        $data=$request->validate(['key'=>['required','string','max:128']]);
        $this->validateStateKey($data['key']);
        DB::table('user_states')->where('user_id',$request->user()->id)->where('key',$data['key'])->delete();
        return response()->json(['ok'=>true]);
    }

    public function putGlobalState(Request $request): JsonResponse
    {
        abort_unless($request->user()->role==='admin',403);
        $data=$request->validate(['key'=>['required','string','max:128'],'value'=>['nullable']]);
        $this->validateStateKey($data['key']);
        $json=$this->encodeState($data['value']??null);
        DB::table('global_states')->updateOrInsert(['key'=>$data['key']],['value'=>$json,'updated_at'=>now()]);
        return response()->json(['ok'=>true]);
    }

    public function deleteGlobalState(Request $request): JsonResponse
    {
        abort_unless($request->user()->role==='admin',403);
        $data=$request->validate(['key'=>['required','string','max:128']]);
        $this->validateStateKey($data['key']);
        DB::table('global_states')->where('key',$data['key'])->delete();
        return response()->json(['ok'=>true]);
    }

    public function syncCourseOverrides(Request $request): JsonResponse
    {
        abort_unless($this->isStaff($request->user()),403);
        $data=$request->validate([
            'courses'=>['required','array','max:100'],'courses.*'=>['array'],
            'courses.*.title'=>['sometimes','string','max:255'],'courses.*.category'=>['sometimes','string','max:120'],
            'courses.*.subtitle'=>['sometimes','nullable','string','max:2000'],'courses.*.description'=>['sometimes','nullable','string','max:20000'],
            'courses.*.price'=>['sometimes','integer','min:0','max:10000000'],'courses.*.status'=>['sometimes','string','in:published,hidden,draft'],
            'courses.*.image'=>['sometimes','nullable','string','max:2000'],'courses.*.badge'=>['sometimes','nullable','string','max:80'],
        ]);
        foreach($data['courses'] as $slug=>$patch){
            $course=DB::table('courses')->where('slug',$slug)->first();if(!$course)continue;
            abort_unless($this->canManageCourse($request->user(),$course),403);
            $allowed=[];foreach(['title','category','subtitle','description','price','status','image','badge'] as $k){if(array_key_exists($k,$patch))$allowed[$k]=$patch[$k];}
            if($allowed){$allowed['updated_at']=now();DB::table('courses')->where('id',$course->id)->update($allowed);}
        }
        return response()->json(['ok'=>true]);
    }

    public function syncCurriculum(Request $request,string $slug): JsonResponse
    {
        abort_unless($this->isStaff($request->user()),403);
        $data=$request->validate(['sections'=>['required','array','max:100']]);$course=DB::table('courses')->where('slug',$slug)->first();abort_unless($course,404);abort_unless($this->canManageCourse($request->user(),$course),403);
        DB::transaction(function()use($course,$data){
            $ids=DB::table('course_sections')->where('course_id',$course->id)->pluck('id');if($ids->isNotEmpty())DB::table('lessons')->whereIn('course_section_id',$ids)->delete();DB::table('course_sections')->where('course_id',$course->id)->delete();
            foreach($data['sections'] as $si=>$section){
                if(!is_array($section))continue;$title=trim((string)($section['title']??'Course section'));abort_if($title===''||mb_strlen($title)>255,422,'Invalid section title.');
                $lectures=$section['lectures']??[];abort_unless(is_array($lectures),422,'Invalid lectures.');abort_if(count($lectures)>300,422,'Too many lectures in a section.');
                $sid=DB::table('course_sections')->insertGetId(['course_id'=>$course->id,'title'=>$title,'position'=>$si+1,'created_at'=>now(),'updated_at'=>now()]);
                foreach($lectures as $li=>$lecture){$row=is_array($lecture)?$lecture:['title'=>$lecture];$lessonTitle=trim((string)($row['title']??'Lesson'));abort_if($lessonTitle===''||mb_strlen($lessonTitle)>255,422,'Invalid lesson title.');$content=$row['content']??null;$video=$row['video_url']??null;abort_if($content!==null&&mb_strlen((string)$content)>100000,422,'Lesson content is too large.');abort_if($video!==null&&mb_strlen((string)$video)>2000,422,'Video URL is too long.');DB::table('lessons')->insert(['course_section_id'=>$sid,'title'=>$lessonTitle,'content'=>$content!==null?(string)$content:null,'video_url'=>$video!==null?(string)$video:null,'duration_seconds'=>isset($row['duration_seconds'])?max(0,(int)$row['duration_seconds']):null,'position'=>$li+1,'is_preview'=>(bool)($row['is_preview']??false),'created_at'=>now(),'updated_at'=>now()]);}
            }
        });
        return response()->json(['ok'=>true]);
    }

    public function syncAnnouncements(Request $request,string $slug): JsonResponse
    {
        abort_unless($this->isStaff($request->user()),403);
        $data=$request->validate(['announcements'=>['required','array','max:100'],'announcements.*.title'=>['required','string','max:255'],'announcements.*.text'=>['required','string','max:10000']]);
        $course=DB::table('courses')->where('slug',$slug)->first();abort_unless($course,404);abort_unless($this->canManageCourse($request->user(),$course),403);
        DB::transaction(function()use($request,$course,$data){DB::table('announcements')->where('course_id',$course->id)->delete();foreach(array_reverse($data['announcements']) as $a){DB::table('announcements')->insert(['course_id'=>$course->id,'user_id'=>$request->user()->id,'title'=>trim($a['title']),'body'=>$a['text'],'created_at'=>now(),'updated_at'=>now()]);}});
        return response()->json(['ok'=>true]);
    }

    public function syncCoupons(Request $request): JsonResponse
    {
        abort_unless($this->isStaff($request->user()),403);
        $data=$request->validate(['coupons'=>['required','array','max:100']]);$user=$request->user();$seen=[];
        DB::transaction(function()use($data,$user,&$seen){
            foreach($data['coupons'] as $coupon){
                if(!is_array($coupon))continue;$code=strtoupper(trim((string)($coupon['code']??'')));$discount=(int)($coupon['discount']??0);$courseSlug=(string)($coupon['course']??'all');
                abort_unless((bool)preg_match('/^[A-Z0-9_-]{3,80}$/',$code),422,'Invalid coupon code.');abort_unless($discount>=1&&$discount<=90,422,'Coupon discount must be between 1 and 90 percent.');$courseId=null;
                if($courseSlug!=='all'){$course=DB::table('courses')->where('slug',$courseSlug)->first();abort_unless($course,422,'Coupon course not found.');abort_unless($this->canManageCourse($user,$course),403);$courseId=$course->id;}elseif($user->role!=='admin')abort(403,'Only administrators can create site-wide coupons.');
                $existing=DB::table('coupons')->where('code',$code)->first();if($existing&&$user->role!=='admin'&&(int)$existing->course_id!==(int)$courseId)abort(409,'Coupon code is already in use.');
                DB::table('coupons')->updateOrInsert(['code'=>$code],['course_id'=>$courseId,'discount_type'=>'percent','discount_value'=>$discount,'active'=>true,'updated_at'=>now()]);$seen[]=$code;
            }
            $managed=DB::table('coupons')->where('code','!=','WELCOME20');if($user->role==='instructor'){$owned=DB::table('courses')->where('instructor_id',$user->id)->pluck('id');$managed->whereIn('course_id',$owned);}if($seen)$managed->whereNotIn('code',$seen)->update(['active'=>false,'updated_at'=>now()]);else $managed->update(['active'=>false,'updated_at'=>now()]);
        });
        return response()->json(['ok'=>true]);
    }

    public function checkout(Request $request): JsonResponse
    {
        $data=$request->validate(['course_slugs'=>['required','array','min:1','max:50'],'course_slugs.*'=>['string','max:120'],'payment_method'=>['nullable','string','in:card,bank,wallet,demo'],'coupon_code'=>['nullable','string','max:80']]);
        $slugs=array_values(array_unique(array_map('strval',$data['course_slugs'])));$courses=DB::table('courses')->whereIn('slug',$slugs)->where('status','published')->get();abort_if($courses->count()!==count($slugs),422,'One or more selected courses are unavailable.');$user=$request->user();
        $already=DB::table('enrollments as e')->join('courses as c','c.id','=','e.course_id')->where('e.user_id',$user->id)->whereIn('c.slug',$slugs)->pluck('c.slug');abort_if($already->isNotEmpty(),422,'You are already enrolled in: '.$already->implode(', '));
        $result=DB::transaction(function()use($courses,$user,$data){
            $subtotal=(int)$courses->sum('price');$discountTotal=0;$couponCode=null;$coupon=null;$requestedCode=strtoupper(trim((string)($data['coupon_code']??'')));
            if($requestedCode!==''){$coupon=DB::table('coupons')->where('code',$requestedCode)->lockForUpdate()->first();abort_unless($coupon&&$coupon->active,422,'Coupon is invalid or inactive.');$now=now();abort_if($coupon->starts_at&&$now->lt($coupon->starts_at),422,'Coupon is not active yet.');abort_if($coupon->ends_at&&$now->gt($coupon->ends_at),422,'Coupon has expired.');abort_if($coupon->max_uses!==null&&(int)$coupon->uses>=(int)$coupon->max_uses,422,'Coupon usage limit has been reached.');$base=$subtotal;if($coupon->course_id){$target=$courses->firstWhere('id',$coupon->course_id);abort_unless($target,422,'Coupon does not apply to this order.');$base=(int)$target->price;}$discountTotal=$coupon->discount_type==='fixed'?min($base,(int)$coupon->discount_value):(int)round($base*min(100,(int)$coupon->discount_value)/100);$couponCode=$coupon->code;}
            $total=max(0,$subtotal-$discountTotal);$number='BWA-'.strtoupper(Str::random(10));$orderId=DB::table('orders')->insertGetId(['user_id'=>$user->id,'number'=>$number,'total'=>$total,'status'=>'completed','payment_method'=>$data['payment_method']??'demo','metadata'=>json_encode(['source'=>'web','subtotal'=>$subtotal,'discount_total'=>$discountTotal,'coupon_code'=>$couponCode]),'created_at'=>now(),'updated_at'=>now()]);
            foreach($courses as $c){DB::table('order_items')->insert(['order_id'=>$orderId,'course_id'=>$c->id,'price'=>$c->price,'created_at'=>now(),'updated_at'=>now()]);$inserted=DB::table('enrollments')->insertOrIgnore(['user_id'=>$user->id,'course_id'=>$c->id,'progress'=>0,'enrolled_at'=>now(),'created_at'=>now(),'updated_at'=>now()]);if(!$inserted)throw ValidationException::withMessages(['course_slugs'=>'One of these courses is already enrolled.']);DB::table('courses')->where('id',$c->id)->increment('students_count');}if($coupon)DB::table('coupons')->where('id',$coupon->id)->increment('uses');return compact('orderId','subtotal','discountTotal','couponCode');
        });
        $order=DB::table('orders')->where('id',$result['orderId'])->first();return response()->json(['order'=>$order,'subtotal'=>$result['subtotal'],'discount_total'=>$result['discountTotal'],'coupon_code'=>$result['couponCode'],'enrollments'=>$this->canonicalEnrollments($user->id)],201);
    }

    public function syncProgress(Request $request,string $slug): JsonResponse
    {
        $data=$request->validate(['completed_positions'=>['required','array','max:10000'],'completed_positions.*'=>['integer','min:0']]);$u=$request->user();$c=DB::table('courses')->where('slug',$slug)->first();abort_unless($c,404);$en=DB::table('enrollments')->where('user_id',$u->id)->where('course_id',$c->id)->first();abort_unless($en,403,'Enroll in this course first.');$lessons=DB::table('lessons as l')->join('course_sections as s','s.id','=','l.course_section_id')->where('s.course_id',$c->id)->orderBy('s.position')->orderBy('l.position')->select('l.id')->get()->values();
        DB::transaction(function()use($u,$lessons,$data){$ids=$lessons->pluck('id');if($ids->isNotEmpty())DB::table('lesson_progress')->where('user_id',$u->id)->whereIn('lesson_id',$ids)->delete();foreach(array_unique($data['completed_positions']) as $pos){if($lesson=$lessons->get((int)$pos))DB::table('lesson_progress')->insertOrIgnore(['user_id'=>$u->id,'lesson_id'=>$lesson->id,'completed_at'=>now(),'created_at'=>now(),'updated_at'=>now()]);}});
        $total=max(1,$lessons->count());$done=$lessons->isEmpty()?0:DB::table('lesson_progress')->where('user_id',$u->id)->whereIn('lesson_id',$lessons->pluck('id'))->count();$progress=min(100,(int)round($done/$total*100));DB::table('enrollments')->where('id',$en->id)->update(['progress'=>$progress,'completed_at'=>$progress>=100?now():null,'updated_at'=>now()]);return response()->json(['progress'=>$progress]);
    }

    public function reviews(Request $request,string $slug): JsonResponse
    {
        $c=DB::table('courses')->where('slug',$slug)->first();abort_unless($c,404);if($c->status!=='published')abort_unless($this->canManageCourse($request->user(),$c),404);return response()->json(DB::table('reviews as r')->join('users as u','u.id','=','r.user_id')->where('r.course_id',$c->id)->where('r.status','published')->select('r.id','r.rating','r.body','r.created_at','u.name as user_name')->latest('r.created_at')->get());
    }

    public function storeReview(Request $request,string $slug): JsonResponse
    {
        $data=$request->validate(['rating'=>['required','integer','min:1','max:5'],'body'=>['nullable','string','max:3000']]);$c=DB::table('courses')->where('slug',$slug)->where('status','published')->first();abort_unless($c,404);$this->requireCourseAccess($request,$c);DB::table('reviews')->updateOrInsert(['user_id'=>$request->user()->id,'course_id'=>$c->id],['rating'=>$data['rating'],'body'=>$data['body']??null,'status'=>'published','updated_at'=>now()]);$avg=(float)DB::table('reviews')->where('course_id',$c->id)->where('status','published')->avg('rating');DB::table('courses')->where('id',$c->id)->update(['rating'=>round($avg,2),'updated_at'=>now()]);return response()->json(['ok'=>true,'rating'=>round($avg,2)],201);
    }

    public function questions(Request $request,string $slug): JsonResponse
    {
        $c=DB::table('courses')->where('slug',$slug)->first();abort_unless($c,404);if($c->status!=='published')abort_unless($this->canManageCourse($request->user(),$c),404);$qs=DB::table('questions as q')->join('users as u','u.id','=','q.user_id')->where('q.course_id',$c->id)->where('q.status','!=','hidden')->select('q.id','q.title','q.body','q.status','q.created_at','u.name as user_name')->latest('q.created_at')->get();foreach($qs as $q){$q->answers=DB::table('answers as a')->join('users as u','u.id','=','a.user_id')->where('a.question_id',$q->id)->select('a.id','a.body','a.created_at','u.name as user_name')->orderBy('a.created_at')->get();}return response()->json($qs);
    }

    public function storeQuestion(Request $request,string $slug): JsonResponse
    {
        $data=$request->validate(['title'=>['required','string','max:180'],'body'=>['required','string','max:5000'],'lesson_id'=>['nullable','integer']]);$c=DB::table('courses')->where('slug',$slug)->where('status','published')->first();abort_unless($c,404);$this->requireCourseAccess($request,$c);if(!empty($data['lesson_id'])){$valid=DB::table('lessons as l')->join('course_sections as s','s.id','=','l.course_section_id')->where('l.id',$data['lesson_id'])->where('s.course_id',$c->id)->exists();abort_unless($valid,422,'Lesson does not belong to this course.');}$id=DB::table('questions')->insertGetId(['user_id'=>$request->user()->id,'course_id'=>$c->id,'lesson_id'=>$data['lesson_id']??null,'title'=>$data['title'],'body'=>$data['body'],'status'=>'open','created_at'=>now(),'updated_at'=>now()]);return response()->json(DB::table('questions')->find($id),201);
    }

    public function answer(Request $request,int $question): JsonResponse
    {
        $data=$request->validate(['body'=>['required','string','max:5000']]);$q=DB::table('questions')->where('id',$question)->first();abort_unless($q,404);$course=DB::table('courses')->where('id',$q->course_id)->first();abort_unless($course,404);$this->requireCourseAccess($request,$course);$id=DB::table('answers')->insertGetId(['question_id'=>$question,'user_id'=>$request->user()->id,'body'=>$data['body'],'created_at'=>now(),'updated_at'=>now()]);return response()->json(DB::table('answers')->find($id),201);
    }

    public function messages(Request $request): JsonResponse
    {
        $id=$request->user()->id;return response()->json(DB::table('messages as m')->join('users as s','s.id','=','m.sender_id')->join('users as r','r.id','=','m.recipient_id')->where(function($q)use($id){$q->where('m.sender_id',$id)->orWhere('m.recipient_id',$id);})->latest('m.created_at')->limit(100)->select('m.id','m.sender_id','m.recipient_id','m.subject','m.body','m.read_at','m.created_at','s.name as sender_name','s.email as sender_email','r.name as recipient_name','r.email as recipient_email')->get());
    }

    public function sendMessage(Request $request): JsonResponse
    {
        $data=$request->validate(['recipient_email'=>['required','email','max:190'],'subject'=>['nullable','string','max:180'],'body'=>['required','string','max:5000']]);$recipient=DB::table('users')->where('email',strtolower(trim($data['recipient_email'])))->first();abort_unless($recipient,404,'Recipient not found.');abort_if((int)$recipient->id===(int)$request->user()->id,422,'Choose another recipient.');$id=DB::table('messages')->insertGetId(['sender_id'=>$request->user()->id,'recipient_id'=>$recipient->id,'subject'=>$data['subject']??null,'body'=>$data['body'],'created_at'=>now(),'updated_at'=>now()]);return response()->json(DB::table('messages')->find($id),201);
    }
}
