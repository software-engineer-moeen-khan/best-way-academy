<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminManagementController extends Controller
{
    private function admin(Request $request): User
    {
        $user=$request->user();
        abort_unless($user?->role==='admin',403);
        return $user;
    }

    private function settingValue(mixed $value): mixed
    {
        if(!is_string($value))return $value;
        $decoded=json_decode($value,true);
        return json_last_error()===JSON_ERROR_NONE?$decoded:$value;
    }

    private function settings(): array
    {
        return DB::table('platform_settings')->pluck('value','key')->map(fn($v)=>$this->settingValue($v))->all();
    }

    private function curriculum(int $courseId): array
    {
        return DB::table('course_sections')->where('course_id',$courseId)->orderBy('position')->get()->map(function($section){
            return [
                'id'=>$section->id,
                'title'=>$section->title,
                'position'=>(int)$section->position,
                'lessons'=>DB::table('lessons')->where('course_section_id',$section->id)->orderBy('position')->get()->map(fn($lesson)=>[
                    'id'=>$lesson->id,
                    'title'=>$lesson->title,
                    'content'=>$lesson->content,
                    'video_url'=>$lesson->video_url,
                    'duration_seconds'=>$lesson->duration_seconds,
                    'is_preview'=>(bool)$lesson->is_preview,
                    'position'=>(int)$lesson->position,
                ])->values()->all(),
            ];
        })->values()->all();
    }

    private function coursePayload(object $course): array
    {
        $meta=is_string($course->metadata)?json_decode($course->metadata,true):($course->metadata??[]);
        return [
            'id'=>$course->id,'slug'=>$course->slug,'title'=>$course->title,'category'=>$course->category,
            'subtitle'=>$course->subtitle,'description'=>$course->description,'price'=>(int)$course->price,
            'status'=>$course->status,'rating'=>(float)$course->rating,'students_count'=>(int)$course->students_count,
            'image'=>$course->image,'badge'=>$course->badge,'instructor_id'=>$course->instructor_id,
            'learn'=>$meta['learn']??[],'modules'=>$meta['modules']??[],
            'created_at'=>$course->created_at,'updated_at'=>$course->updated_at,
        ];
    }

    private function uniqueCourseSlug(string $source, ?int $ignoreId=null): string
    {
        $base=Str::slug($source)?:'course';$slug=$base;$i=2;
        while(DB::table('courses')->where('slug',$slug)->when($ignoreId,fn($q)=>$q->where('id','!=',$ignoreId))->exists())$slug=$base.'-'.$i++;
        return $slug;
    }

    private function uniqueCategorySlug(string $source, ?int $ignoreId=null): string
    {
        $base=Str::slug($source)?:'category';$slug=$base;$i=2;
        while(DB::table('course_categories')->where('slug',$slug)->when($ignoreId,fn($q)=>$q->where('id','!=',$ignoreId))->exists())$slug=$base.'-'.$i++;
        return $slug;
    }

    public function workspace(Request $request): JsonResponse
    {
        $this->admin($request);

        $courses=DB::table('courses')->orderByDesc('updated_at')->get()->map(function($course){
            $row=$this->coursePayload($course);
            $row['instructor_name']=$course->instructor_id?DB::table('users')->where('id',$course->instructor_id)->value('name'):null;
            $row['enrollment_count']=(int)DB::table('enrollments')->where('course_id',$course->id)->count();
            $row['section_count']=(int)DB::table('course_sections')->where('course_id',$course->id)->count();
            $row['lesson_count']=(int)DB::table('lessons as l')->join('course_sections as s','s.id','=','l.course_section_id')->where('s.course_id',$course->id)->count();
            return $row;
        })->values();

        $categories=DB::table('course_categories')->orderBy('position')->orderBy('name')->get()->map(function($category){
            return [
                'id'=>$category->id,'name'=>$category->name,'slug'=>$category->slug,'description'=>$category->description,
                'icon'=>$category->icon,'active'=>(bool)$category->active,'position'=>(int)$category->position,
                'course_count'=>(int)DB::table('courses')->where('category',$category->name)->count(),
            ];
        })->values();

        $users=DB::table('users')->orderByDesc('created_at')->limit(500)->get()->map(function($user){
            return [
                'id'=>$user->id,'name'=>$user->name,'email'=>$user->email,'role'=>$user->role,
                'status'=>$user->status??'active','created_at'=>$user->created_at,
                'enrollment_count'=>(int)DB::table('enrollments')->where('user_id',$user->id)->count(),
                'order_count'=>(int)DB::table('orders')->where('user_id',$user->id)->count(),
                'spent'=>(int)DB::table('orders')->where('user_id',$user->id)->where('status','completed')->sum('total'),
            ];
        })->values();

        $enrollments=DB::table('enrollments as e')
            ->join('users as u','u.id','=','e.user_id')->join('courses as c','c.id','=','e.course_id')
            ->orderByDesc('e.updated_at')->limit(500)
            ->select('e.id','e.progress','e.enrolled_at','e.completed_at','e.created_at','u.id as user_id','u.name as user_name','u.email as user_email','c.id as course_id','c.slug as course_slug','c.title as course_title')->get();

        $orders=DB::table('orders as o')->join('users as u','u.id','=','o.user_id')->orderByDesc('o.created_at')->limit(500)
            ->select('o.id','o.number','o.total','o.status','o.payment_method','o.metadata','o.created_at','u.name as customer_name','u.email as customer_email')->get()->map(function($order){
                $order->items=DB::table('order_items as oi')->join('courses as c','c.id','=','oi.course_id')->where('oi.order_id',$order->id)->select('c.id','c.slug','c.title','oi.price')->get();
                return $order;
            });

        $coupons=DB::table('coupons as cp')->leftJoin('courses as c','c.id','=','cp.course_id')->orderByDesc('cp.created_at')
            ->select('cp.*','c.slug as course_slug','c.title as course_title')->limit(300)->get();

        $reviews=DB::table('reviews as r')->join('users as u','u.id','=','r.user_id')->join('courses as c','c.id','=','r.course_id')->orderByDesc('r.created_at')
            ->select('r.id','r.rating','r.body','r.status','r.created_at','u.name as user_name','u.email as user_email','c.title as course_title','c.slug as course_slug')->limit(300)->get();

        $questions=DB::table('questions as q')->join('users as u','u.id','=','q.user_id')->join('courses as c','c.id','=','q.course_id')->orderByDesc('q.created_at')
            ->select('q.id','q.title','q.body','q.status','q.created_at','u.name as user_name','u.email as user_email','c.title as course_title','c.slug as course_slug')->limit(300)->get()->map(function($question){
                $question->answer_count=(int)DB::table('answers')->where('question_id',$question->id)->count();
                return $question;
            });

        $announcements=DB::table('announcements as a')->join('courses as c','c.id','=','a.course_id')->join('users as u','u.id','=','a.user_id')->orderByDesc('a.created_at')
            ->select('a.id','a.title','a.body','a.created_at','c.id as course_id','c.slug as course_slug','c.title as course_title','u.name as author_name')->limit(300)->get();

        $support=DB::table('support_requests')->orderByDesc('created_at')->limit(300)->get();

        return response()->json([
            'metrics'=>[
                'courses'=>(int)DB::table('courses')->count(),
                'published_courses'=>(int)DB::table('courses')->where('status','published')->count(),
                'categories'=>(int)DB::table('course_categories')->where('active',true)->count(),
                'students'=>(int)DB::table('users')->where('role','student')->count(),
                'instructors'=>(int)DB::table('users')->where('role','instructor')->count(),
                'enrollments'=>(int)DB::table('enrollments')->count(),
                'orders'=>(int)DB::table('orders')->count(),
                'revenue'=>(int)DB::table('orders')->where('status','completed')->sum('total'),
                'open_support'=>(int)DB::table('support_requests')->whereIn('status',['open','in_progress'])->count(),
                'pending_reviews'=>(int)DB::table('reviews')->where('status','!=','published')->count(),
            ],
            'courses'=>$courses,'categories'=>$categories,'users'=>$users,'enrollments'=>$enrollments,
            'orders'=>$orders,'coupons'=>$coupons,'reviews'=>$reviews,'questions'=>$questions,
            'announcements'=>$announcements,'support'=>$support,'settings'=>$this->settings(),
        ]);
    }

    public function createCourse(Request $request): JsonResponse
    {
        $admin=$this->admin($request);
        $data=$request->validate([
            'title'=>['required','string','max:255'],'slug'=>['nullable','string','max:120'],
            'category'=>['required','string','max:120'],'subtitle'=>['nullable','string','max:2000'],
            'description'=>['nullable','string','max:30000'],'price'=>['required','integer','min:0','max:10000000'],
            'status'=>['required','string','in:published,hidden,draft'],'image'=>['nullable','string','max:2000'],
            'badge'=>['nullable','string','max:80'],'instructor_id'=>['nullable','integer'],
            'learn'=>['nullable','array','max:30'],'learn.*'=>['string','max:500'],
            'modules'=>['nullable','array','max:100'],'modules.*'=>['string','max:500'],
        ]);
        abort_unless(DB::table('course_categories')->where('name',$data['category'])->where('active',true)->exists(),422,'Choose an active category.');
        $instructorId=$data['instructor_id']??$admin->id;
        $instructor=DB::table('users')->where('id',$instructorId)->first();
        abort_unless($instructor&&in_array($instructor->role,['admin','instructor'],true),422,'Choose a valid instructor.');
        $slug=$this->uniqueCourseSlug($data['slug']?:$data['title']);
        $id=DB::table('courses')->insertGetId([
            'instructor_id'=>$instructorId,'slug'=>$slug,'title'=>trim($data['title']),'category'=>$data['category'],
            'subtitle'=>$data['subtitle']??null,'description'=>$data['description']??null,'price'=>$data['price'],
            'status'=>$data['status'],'rating'=>0,'students_count'=>0,'image'=>$data['image']??null,'badge'=>$data['badge']??null,
            'metadata'=>json_encode(['learn'=>$data['learn']??[],'modules'=>$data['modules']??[]],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),
            'created_at'=>now(),'updated_at'=>now(),
        ]);
        return response()->json(['ok'=>true,'course'=>$this->coursePayload(DB::table('courses')->where('id',$id)->first())],201);
    }

    public function updateCourse(Request $request,int $course): JsonResponse
    {
        $this->admin($request);$existing=DB::table('courses')->where('id',$course)->first();abort_unless($existing,404);
        $data=$request->validate([
            'title'=>['required','string','max:255'],'slug'=>['nullable','string','max:120'],'category'=>['required','string','max:120'],
            'subtitle'=>['nullable','string','max:2000'],'description'=>['nullable','string','max:30000'],
            'price'=>['required','integer','min:0','max:10000000'],'status'=>['required','string','in:published,hidden,draft'],
            'image'=>['nullable','string','max:2000'],'badge'=>['nullable','string','max:80'],'instructor_id'=>['nullable','integer'],
            'learn'=>['nullable','array','max:30'],'learn.*'=>['string','max:500'],'modules'=>['nullable','array','max:100'],'modules.*'=>['string','max:500'],
        ]);
        abort_unless(DB::table('course_categories')->where('name',$data['category'])->where('active',true)->exists(),422,'Choose an active category.');
        $instructorId=$data['instructor_id']??null;
        if($instructorId){$instructor=DB::table('users')->where('id',$instructorId)->first();abort_unless($instructor&&in_array($instructor->role,['admin','instructor'],true),422,'Choose a valid instructor.');}
        $slug=$data['slug']?Str::slug($data['slug']):$existing->slug;
        if(!$slug)$slug=$this->uniqueCourseSlug($data['title'],$course);
        abort_if(DB::table('courses')->where('slug',$slug)->where('id','!=',$course)->exists(),422,'Course slug is already in use.');
        DB::table('courses')->where('id',$course)->update([
            'instructor_id'=>$instructorId,'slug'=>$slug,'title'=>trim($data['title']),'category'=>$data['category'],
            'subtitle'=>$data['subtitle']??null,'description'=>$data['description']??null,'price'=>$data['price'],'status'=>$data['status'],
            'image'=>$data['image']??null,'badge'=>$data['badge']??null,
            'metadata'=>json_encode(['learn'=>$data['learn']??[],'modules'=>$data['modules']??[]],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),'updated_at'=>now(),
        ]);
        return response()->json(['ok'=>true,'course'=>$this->coursePayload(DB::table('courses')->where('id',$course)->first())]);
    }

    public function deleteCourse(Request $request,int $course): JsonResponse
    {
        $this->admin($request);$row=DB::table('courses')->where('id',$course)->first();abort_unless($row,404);
        $enrollments=DB::table('enrollments')->where('course_id',$course)->count();$orders=DB::table('order_items')->where('course_id',$course)->count();
        abort_if($enrollments>0||$orders>0,409,'This course has learner or order history. Set it to Hidden instead of deleting it.');
        DB::table('courses')->where('id',$course)->delete();
        return response()->json(['ok'=>true]);
    }

    public function getCurriculum(Request $request,int $course): JsonResponse
    {
        $this->admin($request);abort_unless(DB::table('courses')->where('id',$course)->exists(),404);
        return response()->json(['sections'=>$this->curriculum($course)]);
    }

    public function updateCurriculum(Request $request,int $course): JsonResponse
    {
        $this->admin($request);abort_unless(DB::table('courses')->where('id',$course)->exists(),404);
        $data=$request->validate(['sections'=>['required','array','max:100']]);
        DB::transaction(function()use($course,$data){
            $sectionIds=DB::table('course_sections')->where('course_id',$course)->pluck('id');
            if($sectionIds->isNotEmpty())DB::table('lessons')->whereIn('course_section_id',$sectionIds)->delete();
            DB::table('course_sections')->where('course_id',$course)->delete();
            foreach($data['sections'] as $si=>$section){
                if(!is_array($section))continue;$title=trim((string)($section['title']??''));abort_if($title===''||mb_strlen($title)>255,422,'Every section needs a valid title.');
                $sid=DB::table('course_sections')->insertGetId(['course_id'=>$course,'title'=>$title,'position'=>$si+1,'created_at'=>now(),'updated_at'=>now()]);
                $lessons=$section['lessons']??[];abort_unless(is_array($lessons),422,'Invalid lesson list.');abort_if(count($lessons)>300,422,'Too many lessons in a section.');
                foreach($lessons as $li=>$lesson){
                    if(!is_array($lesson))$lesson=['title'=>$lesson];$lessonTitle=trim((string)($lesson['title']??''));abort_if($lessonTitle===''||mb_strlen($lessonTitle)>255,422,'Every lesson needs a valid title.');
                    $content=$lesson['content']??null;$video=$lesson['video_url']??null;
                    abort_if($content!==null&&mb_strlen((string)$content)>100000,422,'Lesson content is too large.');
                    abort_if($video!==null&&mb_strlen((string)$video)>2000,422,'Video URL is too long.');
                    DB::table('lessons')->insert([
                        'course_section_id'=>$sid,'title'=>$lessonTitle,'content'=>$content!==null?(string)$content:null,
                        'video_url'=>$video!==null?(string)$video:null,'duration_seconds'=>isset($lesson['duration_seconds'])?max(0,(int)$lesson['duration_seconds']):null,
                        'position'=>$li+1,'is_preview'=>(bool)($lesson['is_preview']??false),'created_at'=>now(),'updated_at'=>now(),
                    ]);
                }
            }
        });
        return response()->json(['ok'=>true,'sections'=>$this->curriculum($course)]);
    }

    public function createCategory(Request $request): JsonResponse
    {
        $this->admin($request);$data=$request->validate([
            'name'=>['required','string','max:120','unique:course_categories,name'],'slug'=>['nullable','string','max:140'],
            'description'=>['nullable','string','max:3000'],'icon'=>['nullable','string','max:80'],'active'=>['nullable','boolean'],'position'=>['nullable','integer','min:0','max:10000'],
        ]);
        $slug=$this->uniqueCategorySlug($data['slug']?:$data['name']);
        $id=DB::table('course_categories')->insertGetId(['name'=>trim($data['name']),'slug'=>$slug,'description'=>$data['description']??null,'icon'=>$data['icon']??null,'active'=>$data['active']??true,'position'=>$data['position']??0,'created_at'=>now(),'updated_at'=>now()]);
        return response()->json(['ok'=>true,'id'=>$id],201);
    }

    public function updateCategory(Request $request,int $category): JsonResponse
    {
        $this->admin($request);$existing=DB::table('course_categories')->where('id',$category)->first();abort_unless($existing,404);
        $data=$request->validate([
            'name'=>['required','string','max:120',Rule::unique('course_categories','name')->ignore($category)],'slug'=>['nullable','string','max:140'],
            'description'=>['nullable','string','max:3000'],'icon'=>['nullable','string','max:80'],'active'=>['required','boolean'],'position'=>['nullable','integer','min:0','max:10000'],
        ]);
        $slug=$data['slug']?Str::slug($data['slug']):$existing->slug;abort_if(DB::table('course_categories')->where('slug',$slug)->where('id','!=',$category)->exists(),422,'Category slug is already in use.');
        DB::transaction(function()use($existing,$category,$data,$slug){
            DB::table('course_categories')->where('id',$category)->update(['name'=>trim($data['name']),'slug'=>$slug,'description'=>$data['description']??null,'icon'=>$data['icon']??null,'active'=>$data['active'],'position'=>$data['position']??0,'updated_at'=>now()]);
            if($existing->name!==trim($data['name']))DB::table('courses')->where('category',$existing->name)->update(['category'=>trim($data['name']),'updated_at'=>now()]);
        });
        return response()->json(['ok'=>true]);
    }

    public function deleteCategory(Request $request,int $category): JsonResponse
    {
        $this->admin($request);$existing=DB::table('course_categories')->where('id',$category)->first();abort_unless($existing,404);
        abort_if(DB::table('courses')->where('category',$existing->name)->exists(),409,'Move or archive courses in this category before deleting it.');
        DB::table('course_categories')->where('id',$category)->delete();return response()->json(['ok'=>true]);
    }

    public function createUser(Request $request): JsonResponse
    {
        $this->admin($request);$data=$request->validate([
            'name'=>['required','string','max:120'],'email'=>['required','email','max:190','unique:users,email'],
            'role'=>['required','string','in:student,instructor,admin'],'status'=>['required','string','in:active,suspended'],
            'password'=>['required','string','min:8','max:200'],
        ]);
        $id=DB::table('users')->insertGetId(['name'=>trim($data['name']),'email'=>strtolower(trim($data['email'])),'password'=>Hash::make($data['password']),'role'=>$data['role'],'status'=>$data['status'],'created_at'=>now(),'updated_at'=>now()]);
        return response()->json(['ok'=>true,'id'=>$id],201);
    }

    public function updateUser(Request $request,int $user): JsonResponse
    {
        $admin=$this->admin($request);$target=DB::table('users')->where('id',$user)->first();abort_unless($target,404);
        $data=$request->validate([
            'name'=>['required','string','max:120'],'email'=>['required','email','max:190',Rule::unique('users','email')->ignore($user)],
            'role'=>['required','string','in:student,instructor,admin'],'status'=>['required','string','in:active,suspended'],'password'=>['nullable','string','min:8','max:200'],
        ]);
        if((int)$admin->id===$user&&($data['role']!=='admin'||$data['status']!=='active'))throw ValidationException::withMessages(['role'=>'You cannot demote or suspend your own administrator account.']);
        if($target->role==='admin'&&($data['role']!=='admin'||$data['status']!=='active')){
            $otherAdmins=DB::table('users')->where('role','admin')->where('status','active')->where('id','!=',$user)->count();
            abort_if($otherAdmins<1,422,'At least one active administrator must remain.');
        }
        $update=['name'=>trim($data['name']),'email'=>strtolower(trim($data['email'])),'role'=>$data['role'],'status'=>$data['status'],'updated_at'=>now()];
        if(!empty($data['password']))$update['password']=Hash::make($data['password']);
        DB::table('users')->where('id',$user)->update($update);return response()->json(['ok'=>true]);
    }

    public function createEnrollment(Request $request): JsonResponse
    {
        $this->admin($request);$data=$request->validate(['user_id'=>['required','integer'],'course_id'=>['required','integer']]);
        $user=DB::table('users')->where('id',$data['user_id'])->first();$course=DB::table('courses')->where('id',$data['course_id'])->first();
        abort_unless($user&&$user->role==='student',422,'Choose a student account.');abort_unless($course,422,'Choose a valid course.');
        $inserted=DB::table('enrollments')->insertOrIgnore(['user_id'=>$user->id,'course_id'=>$course->id,'progress'=>0,'enrolled_at'=>now(),'created_at'=>now(),'updated_at'=>now()]);
        abort_if(!$inserted,422,'Student is already enrolled in this course.');DB::table('courses')->where('id',$course->id)->increment('students_count');
        return response()->json(['ok'=>true],201);
    }

    public function deleteEnrollment(Request $request,int $enrollment): JsonResponse
    {
        $this->admin($request);$row=DB::table('enrollments')->where('id',$enrollment)->first();abort_unless($row,404);
        $lessonIds=DB::table('lessons as l')->join('course_sections as s','s.id','=','l.course_section_id')->where('s.course_id',$row->course_id)->pluck('l.id');
        DB::transaction(function()use($row,$enrollment,$lessonIds){if($lessonIds->isNotEmpty())DB::table('lesson_progress')->where('user_id',$row->user_id)->whereIn('lesson_id',$lessonIds)->delete();DB::table('enrollments')->where('id',$enrollment)->delete();DB::table('courses')->where('id',$row->course_id)->where('students_count','>',0)->decrement('students_count');});
        return response()->json(['ok'=>true]);
    }

    public function updateOrder(Request $request,int $order): JsonResponse
    {
        $this->admin($request);$data=$request->validate(['status'=>['required','string','in:pending,completed,refunded,cancelled'],'payment_method'=>['nullable','string','max:50']]);
        $updated=DB::table('orders')->where('id',$order)->update(['status'=>$data['status'],'payment_method'=>$data['payment_method']??null,'updated_at'=>now()]);abort_unless($updated||DB::table('orders')->where('id',$order)->exists(),404);
        return response()->json(['ok'=>true]);
    }

    public function createCoupon(Request $request): JsonResponse
    {
        $this->admin($request);$data=$this->validateCoupon($request);$id=$this->saveCoupon(null,$data);return response()->json(['ok'=>true,'id'=>$id],201);
    }

    public function updateCoupon(Request $request,int $coupon): JsonResponse
    {
        $this->admin($request);abort_unless(DB::table('coupons')->where('id',$coupon)->exists(),404);$data=$this->validateCoupon($request,$coupon);$this->saveCoupon($coupon,$data);return response()->json(['ok'=>true]);
    }

    private function validateCoupon(Request $request,?int $ignore=null): array
    {
        return $request->validate([
            'code'=>['required','string','max:80',Rule::unique('coupons','code')->ignore($ignore)],'course_id'=>['nullable','integer','exists:courses,id'],
            'discount_type'=>['required','string','in:percent,fixed'],'discount_value'=>['required','integer','min:1','max:10000000'],
            'starts_at'=>['nullable','date'],'ends_at'=>['nullable','date','after_or_equal:starts_at'],'max_uses'=>['nullable','integer','min:1','max:10000000'],'active'=>['required','boolean'],
        ]);
    }

    private function saveCoupon(?int $id,array $data): int
    {
        if($data['discount_type']==='percent'&&(int)$data['discount_value']>100)throw ValidationException::withMessages(['discount_value'=>'Percentage discount cannot exceed 100.']);
        $row=['code'=>strtoupper(trim($data['code'])),'course_id'=>$data['course_id']??null,'discount_type'=>$data['discount_type'],'discount_value'=>$data['discount_value'],'starts_at'=>$data['starts_at']??null,'ends_at'=>$data['ends_at']??null,'max_uses'=>$data['max_uses']??null,'active'=>$data['active'],'updated_at'=>now()];
        if($id){DB::table('coupons')->where('id',$id)->update($row);return $id;}$row['uses']=0;$row['created_at']=now();return DB::table('coupons')->insertGetId($row);
    }

    public function deleteCoupon(Request $request,int $coupon): JsonResponse
    {
        $this->admin($request);$deleted=DB::table('coupons')->where('id',$coupon)->delete();abort_unless($deleted,404);return response()->json(['ok'=>true]);
    }

    public function updateReview(Request $request,int $review): JsonResponse
    {
        $this->admin($request);$data=$request->validate(['status'=>['required','string','in:published,hidden,pending']]);$row=DB::table('reviews')->where('id',$review)->first();abort_unless($row,404);DB::table('reviews')->where('id',$review)->update(['status'=>$data['status'],'updated_at'=>now()]);
        $avg=(float)(DB::table('reviews')->where('course_id',$row->course_id)->where('status','published')->avg('rating')??0);DB::table('courses')->where('id',$row->course_id)->update(['rating'=>round($avg,2),'updated_at'=>now()]);return response()->json(['ok'=>true]);
    }

    public function deleteReview(Request $request,int $review): JsonResponse
    {
        $this->admin($request);$row=DB::table('reviews')->where('id',$review)->first();abort_unless($row,404);DB::table('reviews')->where('id',$review)->delete();$avg=(float)(DB::table('reviews')->where('course_id',$row->course_id)->where('status','published')->avg('rating')??0);DB::table('courses')->where('id',$row->course_id)->update(['rating'=>round($avg,2),'updated_at'=>now()]);return response()->json(['ok'=>true]);
    }

    public function updateQuestion(Request $request,int $question): JsonResponse
    {
        $this->admin($request);$data=$request->validate(['status'=>['required','string','in:open,resolved,hidden']]);$updated=DB::table('questions')->where('id',$question)->update(['status'=>$data['status'],'updated_at'=>now()]);abort_unless($updated||DB::table('questions')->where('id',$question)->exists(),404);return response()->json(['ok'=>true]);
    }

    public function deleteQuestion(Request $request,int $question): JsonResponse
    {
        $this->admin($request);$deleted=DB::table('questions')->where('id',$question)->delete();abort_unless($deleted,404);return response()->json(['ok'=>true]);
    }

    public function createAnnouncement(Request $request): JsonResponse
    {
        $admin=$this->admin($request);$data=$request->validate(['course_id'=>['required','integer','exists:courses,id'],'title'=>['required','string','max:255'],'body'=>['required','string','max:10000']]);
        $id=DB::table('announcements')->insertGetId(['course_id'=>$data['course_id'],'user_id'=>$admin->id,'title'=>trim($data['title']),'body'=>$data['body'],'created_at'=>now(),'updated_at'=>now()]);return response()->json(['ok'=>true,'id'=>$id],201);
    }

    public function deleteAnnouncement(Request $request,int $announcement): JsonResponse
    {
        $this->admin($request);$deleted=DB::table('announcements')->where('id',$announcement)->delete();abort_unless($deleted,404);return response()->json(['ok'=>true]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $this->admin($request);$data=$request->validate([
            'site_name'=>['required','string','max:120'],'support_email'=>['required','email','max:190'],'currency'=>['required','string','max:10'],
            'currency_symbol'=>['required','string','max:10'],'allow_registration'=>['required','boolean'],'default_course_status'=>['required','string','in:draft,hidden,published'],
        ]);
        foreach($data as $key=>$value)DB::table('platform_settings')->updateOrInsert(['key'=>$key],['value'=>json_encode($value,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),'updated_at'=>now(),'created_at'=>now()]);
        return response()->json(['ok'=>true,'settings'=>$this->settings()]);
    }
}
