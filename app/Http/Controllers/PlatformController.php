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
        $user=User::create(['name'=>$data['name'],'email'=>strtolower($data['email']),'password'=>Hash::make($data['password']),'role'=>'student']);
        Auth::login($user,true); $request->session()->regenerate();
        $redirect=$request->session()->pull('url.intended','/dashboard.html');
        return response()->json(['user'=>$user->only(['id','name','email','role']),'csrf_token'=>csrf_token(),'redirect'=>$redirect],201);
    }

    public function login(Request $request): JsonResponse
    {
        $data=$request->validate(['email'=>['required','email'],'password'=>['required','string']]);
        if(!Auth::attempt(['email'=>strtolower($data['email']),'password'=>$data['password']],true)){
            throw ValidationException::withMessages(['email'=>'The provided credentials are incorrect.']);
        }
        $request->session()->regenerate(); $user=$request->user();
        $redirect=$request->session()->pull('url.intended','/dashboard.html');
        return response()->json(['user'=>$user->only(['id','name','email','role']),'csrf_token'=>csrf_token(),'redirect'=>$redirect]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout(); $request->session()->invalidate(); $request->session()->regenerateToken();
        return response()->json(['ok'=>true,'csrf_token'=>csrf_token()]);
    }

    public function profile(Request $request): JsonResponse
    {
        $u=$request->user();
        $data=$request->validate(['name'=>['required','string','max:120'],'email'=>['required','email','max:190','unique:users,email,'.$u->id]]);
        $u->update(['name'=>$data['name'],'email'=>strtolower($data['email'])]);
        return response()->json(['user'=>$u->only(['id','name','email','role'])]);
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

    public function courses(): JsonResponse
    {
        $rows=DB::table('courses')->where('status','published')->orderBy('id')->get()->map(fn($c)=>$this->legacyCourse($c));
        return response()->json($rows);
    }

    public function course(string $slug): JsonResponse
    {
        $c=DB::table('courses')->where('slug',$slug)->first(); abort_unless($c,404);
        $sections=DB::table('course_sections')->where('course_id',$c->id)->orderBy('position')->get()->map(function($s){
            $s->lessons=DB::table('lessons')->where('course_section_id',$s->id)->orderBy('position')->get(); return $s;
        });
        $out=$this->legacyCourse($c); $out['sections']=$sections;
        return response()->json($out);
    }

    public function bootstrap(Request $request): JsonResponse
    {
        $courses=[]; foreach(DB::table('courses')->orderBy('id')->get() as $c){$courses[$c->slug]=$this->legacyCourse($c);}
        $states=DB::table('user_states')->where('user_id',$request->user()->id)->pluck('value','key')->map(fn($v)=>json_decode($v,true));
        $globals=DB::table('global_states')->pluck('value','key')->map(fn($v)=>json_decode($v,true));
        return response()->json(['user'=>$request->user()->only(['id','name','email','role']),'courses'=>$courses,'states'=>$states,'global_states'=>$globals,'csrf_token'=>csrf_token()]);
    }

    private function validateStateKey(string $key): void
    {
        abort_unless((bool)preg_match('/^bwa_[A-Za-z0-9_.:-]{1,120}$/',$key),422,'Invalid state key.');
    }

    public function putState(Request $request): JsonResponse
    {
        $data=$request->validate(['key'=>['required','string','max:128'],'value'=>['nullable']]); $this->validateStateKey($data['key']);
        DB::table('user_states')->updateOrInsert(['user_id'=>$request->user()->id,'key'=>$data['key']],['value'=>json_encode($data['value']??null,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),'updated_at'=>now(),'created_at'=>now()]);
        return response()->json(['ok'=>true]);
    }

    public function deleteState(Request $request): JsonResponse
    {
        $data=$request->validate(['key'=>['required','string','max:128']]); $this->validateStateKey($data['key']);
        DB::table('user_states')->where('user_id',$request->user()->id)->where('key',$data['key'])->delete(); return response()->json(['ok'=>true]);
    }

    public function putGlobalState(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role,['admin','instructor'],true),403);
        $data=$request->validate(['key'=>['required','string','max:128'],'value'=>['nullable']]); $this->validateStateKey($data['key']);
        DB::table('global_states')->updateOrInsert(['key'=>$data['key']],['value'=>json_encode($data['value']??null,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),'updated_at'=>now(),'created_at'=>now()]);
        return response()->json(['ok'=>true]);
    }

    public function syncCourseOverrides(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role,['admin','instructor'],true),403);
        $data=$request->validate(['courses'=>['required','array']]);
        foreach($data['courses'] as $slug=>$patch){
            if(!is_array($patch))continue; $allowed=[];
            foreach(['title','category','subtitle','description','price','status','image','badge'] as $k){if(array_key_exists($k,$patch))$allowed[$k]=$patch[$k];}
            if(isset($allowed['price']))$allowed['price']=max(0,(int)$allowed['price']);
            if(isset($allowed['status'])&&!in_array($allowed['status'],['published','hidden','draft'],true))unset($allowed['status']);
            if($allowed){$allowed['updated_at']=now();DB::table('courses')->where('slug',$slug)->update($allowed);}
        }
        return response()->json(['ok'=>true]);
    }

    public function syncCurriculum(Request $request,string $slug): JsonResponse
    {
        abort_unless(in_array($request->user()->role,['admin','instructor'],true),403);
        $data=$request->validate(['sections'=>['required','array']]); $course=DB::table('courses')->where('slug',$slug)->first(); abort_unless($course,404);
        DB::transaction(function()use($course,$data){
            $ids=DB::table('course_sections')->where('course_id',$course->id)->pluck('id'); if($ids->isNotEmpty())DB::table('lessons')->whereIn('course_section_id',$ids)->delete(); DB::table('course_sections')->where('course_id',$course->id)->delete();
            foreach($data['sections'] as $si=>$section){if(!is_array($section))continue;$sid=DB::table('course_sections')->insertGetId(['course_id'=>$course->id,'title'=>(string)($section['title']??'Course section'),'position'=>$si+1,'created_at'=>now(),'updated_at'=>now()]);
                foreach(($section['lectures']??[]) as $li=>$lecture){$title=is_array($lecture)?($lecture['title']??'Lesson'):$lecture;DB::table('lessons')->insert(['course_section_id'=>$sid,'title'=>(string)$title,'content'=>is_array($lecture)?($lecture['content']??null):null,'video_url'=>is_array($lecture)?($lecture['video_url']??null):null,'position'=>$li+1,'is_preview'=>(bool)(is_array($lecture)?($lecture['is_preview']??false):false),'created_at'=>now(),'updated_at'=>now()]);}
            }
        });
        return response()->json(['ok'=>true]);
    }

    public function checkout(Request $request): JsonResponse
    {
        $data=$request->validate(['course_slugs'=>['required','array','min:1'],'course_slugs.*'=>['string'],'payment_method'=>['nullable','string','max:40']]);
        $courses=DB::table('courses')->whereIn('slug',array_unique($data['course_slugs']))->where('status','published')->get(); abort_if($courses->isEmpty(),422,'No purchasable courses selected.');
        $total=(int)$courses->sum('price'); $user=$request->user();
        $orderId=DB::transaction(function()use($courses,$total,$user,$data){$number='BWA-'.strtoupper(Str::random(10));$id=DB::table('orders')->insertGetId(['user_id'=>$user->id,'number'=>$number,'total'=>$total,'status'=>'completed','payment_method'=>$data['payment_method']??'demo','metadata'=>json_encode(['source'=>'web']),'created_at'=>now(),'updated_at'=>now()]);
            foreach($courses as $c){DB::table('order_items')->insert(['order_id'=>$id,'course_id'=>$c->id,'price'=>$c->price,'created_at'=>now(),'updated_at'=>now()]);DB::table('enrollments')->updateOrInsert(['user_id'=>$user->id,'course_id'=>$c->id],['enrolled_at'=>now(),'updated_at'=>now(),'created_at'=>now()]);}return $id;});
        $order=DB::table('orders')->where('id',$orderId)->first();
        $enroll=DB::table('enrollments as e')->join('courses as c','c.id','=','e.course_id')->where('e.user_id',$user->id)->select('e.*','c.slug as course_slug','c.title as course_title')->get()->map(fn($e)=>['progress'=>(int)$e->progress,'enrolled_at'=>$e->enrolled_at,'created_at'=>$e->created_at,'course'=>['slug'=>$e->course_slug,'title'=>$e->course_title]]);
        return response()->json(['order'=>$order,'enrollments'=>$enroll],201);
    }

    public function syncProgress(Request $request,string $slug): JsonResponse
    {
        $data=$request->validate(['completed_positions'=>['required','array'],'completed_positions.*'=>['integer','min:0']]); $u=$request->user(); $c=DB::table('courses')->where('slug',$slug)->first(); abort_unless($c,404);
        $en=DB::table('enrollments')->where('user_id',$u->id)->where('course_id',$c->id)->first(); abort_unless($en,403,'Enroll in this course first.');
        $lessons=DB::table('lessons as l')->join('course_sections as s','s.id','=','l.course_section_id')->where('s.course_id',$c->id)->orderBy('s.position')->orderBy('l.position')->select('l.id')->get()->values();
        DB::transaction(function()use($u,$lessons,$data){$ids=$lessons->pluck('id');if($ids->isNotEmpty())DB::table('lesson_progress')->where('user_id',$u->id)->whereIn('lesson_id',$ids)->delete();foreach(array_unique($data['completed_positions']) as $pos){if($lesson=$lessons->get((int)$pos))DB::table('lesson_progress')->insert(['user_id'=>$u->id,'lesson_id'=>$lesson->id,'completed_at'=>now(),'created_at'=>now(),'updated_at'=>now()]);}});
        $total=max(1,$lessons->count());$done=DB::table('lesson_progress')->where('user_id',$u->id)->whereIn('lesson_id',$lessons->pluck('id'))->count();$progress=min(100,(int)round($done/$total*100));DB::table('enrollments')->where('id',$en->id)->update(['progress'=>$progress,'completed_at'=>$progress>=100?now():null,'updated_at'=>now()]);return response()->json(['progress'=>$progress]);
    }

    public function reviews(string $slug): JsonResponse
    {
        $c=DB::table('courses')->where('slug',$slug)->first();abort_unless($c,404);return response()->json(DB::table('reviews as r')->join('users as u','u.id','=','r.user_id')->where('r.course_id',$c->id)->where('r.status','published')->select('r.*','u.name as user_name')->latest('r.created_at')->get());
    }

    public function storeReview(Request $request,string $slug): JsonResponse
    {
        $data=$request->validate(['rating'=>['required','integer','min:1','max:5'],'body'=>['nullable','string','max:3000']]);$c=DB::table('courses')->where('slug',$slug)->first();abort_unless($c,404);DB::table('reviews')->updateOrInsert(['user_id'=>$request->user()->id,'course_id'=>$c->id],['rating'=>$data['rating'],'body'=>$data['body']??null,'status'=>'published','updated_at'=>now(),'created_at'=>now()]);return response()->json(['ok'=>true],201);
    }

    public function questions(string $slug): JsonResponse
    {
        $c=DB::table('courses')->where('slug',$slug)->first();abort_unless($c,404);$qs=DB::table('questions as q')->join('users as u','u.id','=','q.user_id')->where('q.course_id',$c->id)->select('q.*','u.name as user_name')->latest('q.created_at')->get();foreach($qs as $q){$q->answers=DB::table('answers as a')->join('users as u','u.id','=','a.user_id')->where('a.question_id',$q->id)->select('a.*','u.name as user_name')->get();}return response()->json($qs);
    }

    public function storeQuestion(Request $request,string $slug): JsonResponse
    {
        $data=$request->validate(['title'=>['required','string','max:180'],'body'=>['required','string','max:5000'],'lesson_id'=>['nullable','integer']]);$c=DB::table('courses')->where('slug',$slug)->first();abort_unless($c,404);$id=DB::table('questions')->insertGetId(['user_id'=>$request->user()->id,'course_id'=>$c->id,'lesson_id'=>$data['lesson_id']??null,'title'=>$data['title'],'body'=>$data['body'],'status'=>'open','created_at'=>now(),'updated_at'=>now()]);return response()->json(DB::table('questions')->find($id),201);
    }

    public function answer(Request $request,int $question): JsonResponse
    {
        $data=$request->validate(['body'=>['required','string','max:5000']]);abort_unless(DB::table('questions')->where('id',$question)->exists(),404);$id=DB::table('answers')->insertGetId(['question_id'=>$question,'user_id'=>$request->user()->id,'body'=>$data['body'],'created_at'=>now(),'updated_at'=>now()]);return response()->json(DB::table('answers')->find($id),201);
    }

    public function messages(Request $request): JsonResponse
    {
        $id=$request->user()->id;return response()->json(DB::table('messages')->where('sender_id',$id)->orWhere('recipient_id',$id)->latest()->limit(100)->get());
    }

    public function sendMessage(Request $request): JsonResponse
    {
        $data=$request->validate(['recipient_email'=>['required','email'],'subject'=>['nullable','string','max:180'],'body'=>['required','string','max:5000']]);$recipient=DB::table('users')->where('email',strtolower($data['recipient_email']))->first();abort_unless($recipient,404,'Recipient not found.');$id=DB::table('messages')->insertGetId(['sender_id'=>$request->user()->id,'recipient_id'=>$recipient->id,'subject'=>$data['subject']??null,'body'=>$data['body'],'created_at'=>now(),'updated_at'=>now()]);return response()->json(DB::table('messages')->find($id),201);
    }
}
