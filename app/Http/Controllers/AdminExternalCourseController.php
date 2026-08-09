<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminExternalCourseController extends Controller
{
    private function admin(Request $request): User
    {
        $user=$request->user();
        abort_unless($user?->role==='admin',403);
        return $user;
    }

    private function cleanLink(?string $value): string
    {
        $value=trim((string)$value);
        if($value==='')throw ValidationException::withMessages(['course_link'=>'Course Link is required.']);
        if(mb_strlen($value)>2048||preg_match('/[\x00-\x1F\x7F]/u',$value)){
            throw ValidationException::withMessages(['course_link'=>'Enter a valid course link.']);
        }
        if(preg_match('/^(javascript|data|vbscript|file|about):/i',$value)){
            throw ValidationException::withMessages(['course_link'=>'This link type is not allowed.']);
        }
        if(str_starts_with($value,'/')||str_starts_with($value,'#')||str_starts_with($value,'?'))return $value;
        if(preg_match('/^([a-z][a-z0-9+.-]*):/i',$value,$match)){
            $scheme=strtolower($match[1]);
            if(in_array($scheme,['http','https'],true)&&!filter_var($value,FILTER_VALIDATE_URL)){
                throw ValidationException::withMessages(['course_link'=>'Enter a valid web link.']);
            }
            return $value;
        }
        if(preg_match('/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d{1,5})?(?:[\/?#].*)?$/i',$value)){
            $normalized='https://'.$value;
            if(filter_var($normalized,FILTER_VALIDATE_URL))return $normalized;
        }
        throw ValidationException::withMessages(['course_link'=>'Enter a valid Udemy, web, internal, or app/deep link.']);
    }

    private function uniqueSlug(string $source,?int $ignoreId=null): string
    {
        $base=Str::slug($source)?:'course';$slug=$base;$i=2;
        while(DB::table('courses')->where('slug',$slug)->when($ignoreId,fn($q)=>$q->where('id','!=',$ignoreId))->exists())$slug=$base.'-'.$i++;
        return $slug;
    }

    private function payload(object $course): array
    {
        $meta=is_string($course->metadata)?(json_decode($course->metadata,true)?:[]):((array)($course->metadata??[]));
        return [
            'id'=>(int)$course->id,'slug'=>$course->slug,'title'=>$course->title,'category'=>$course->category,
            'subtitle'=>$course->subtitle,'description'=>$course->description,'price'=>(int)$course->price,
            'status'=>$course->status,'rating'=>(float)$course->rating,'students_count'=>(int)$course->students_count,
            'image'=>$course->image,'badge'=>$course->badge,'instructor_id'=>$course->instructor_id,
            'course_link'=>$course->course_link,'learn'=>$meta['learn']??[],'modules'=>$meta['modules']??[],
            'created_at'=>$course->created_at,'updated_at'=>$course->updated_at,
        ];
    }

    private function validated(Request $request,bool $requireLink): array
    {
        $linkRule=$requireLink?['required','string','max:2048']:['sometimes','required','string','max:2048'];
        $data=$request->validate([
            'title'=>['required','string','max:255'],'slug'=>['nullable','string','max:120'],
            'category'=>['required','string','max:120'],'subtitle'=>['nullable','string','max:2000'],
            'description'=>['nullable','string','max:30000'],'price'=>['required','integer','min:0','max:10000000'],
            'status'=>['required','string','in:published,hidden,draft'],'image'=>['nullable','string','max:2000'],
            'badge'=>['nullable','string','max:80'],'instructor_id'=>['nullable','integer'],
            'course_link'=>$linkRule,
            'learn'=>['nullable','array','max:30'],'learn.*'=>['string','max:500'],
            'modules'=>['nullable','array','max:100'],'modules.*'=>['string','max:500'],
        ]);
        if(array_key_exists('course_link',$data))$data['course_link']=$this->cleanLink($data['course_link']);
        return $data;
    }

    public function create(Request $request): JsonResponse
    {
        $admin=$this->admin($request);$data=$this->validated($request,true);
        abort_unless(DB::table('course_categories')->where('name',$data['category'])->where('active',true)->exists(),422,'Choose an active category.');
        $instructorId=$data['instructor_id']??$admin->id;
        $instructor=DB::table('users')->where('id',$instructorId)->first();
        abort_unless($instructor&&in_array($instructor->role,['admin','instructor'],true),422,'Choose a valid instructor.');
        $slug=$this->uniqueSlug($data['slug']?:$data['title']);
        $id=DB::table('courses')->insertGetId([
            'instructor_id'=>$instructorId,'slug'=>$slug,'title'=>trim($data['title']),'category'=>$data['category'],
            'subtitle'=>$data['subtitle']??null,'description'=>$data['description']??null,'price'=>$data['price'],
            'status'=>$data['status'],'rating'=>0,'students_count'=>0,'image'=>$data['image']??null,'badge'=>$data['badge']??null,
            'course_link'=>$data['course_link'],
            'metadata'=>json_encode(['learn'=>$data['learn']??[],'modules'=>$data['modules']??[]],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),
            'created_at'=>now(),'updated_at'=>now(),
        ]);
        return response()->json(['ok'=>true,'course'=>$this->payload(DB::table('courses')->where('id',$id)->first())],201)
            ->header('Cache-Control','no-store, no-cache, must-revalidate');
    }

    public function update(Request $request,int $course): JsonResponse
    {
        $this->admin($request);$existing=DB::table('courses')->where('id',$course)->first();abort_unless($existing,404);
        $data=$this->validated($request,false);
        abort_unless(DB::table('course_categories')->where('name',$data['category'])->where('active',true)->exists(),422,'Choose an active category.');
        $instructorId=$data['instructor_id']??null;
        if($instructorId){$instructor=DB::table('users')->where('id',$instructorId)->first();abort_unless($instructor&&in_array($instructor->role,['admin','instructor'],true),422,'Choose a valid instructor.');}
        $slug=$data['slug']?Str::slug($data['slug']):$existing->slug;
        if(!$slug)$slug=$this->uniqueSlug($data['title'],$course);
        abort_if(DB::table('courses')->where('slug',$slug)->where('id','!=',$course)->exists(),422,'Course slug is already in use.');
        DB::table('courses')->where('id',$course)->update([
            'instructor_id'=>$instructorId,'slug'=>$slug,'title'=>trim($data['title']),'category'=>$data['category'],
            'subtitle'=>$data['subtitle']??null,'description'=>$data['description']??null,'price'=>$data['price'],'status'=>$data['status'],
            'image'=>$data['image']??null,'badge'=>$data['badge']??null,'course_link'=>$data['course_link']??$existing->course_link,
            'metadata'=>json_encode(['learn'=>$data['learn']??[],'modules'=>$data['modules']??[]],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),'updated_at'=>now(),
        ]);
        return response()->json(['ok'=>true,'course'=>$this->payload(DB::table('courses')->where('id',$course)->first())])
            ->header('Cache-Control','no-store, no-cache, must-revalidate');
    }
}
