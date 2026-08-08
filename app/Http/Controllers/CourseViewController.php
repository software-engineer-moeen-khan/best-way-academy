<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CourseViewController extends Controller
{
    public function __invoke(Request $request,string $slug): JsonResponse
    {
        $course=DB::table('courses')->where('slug',$slug)->first();
        abort_unless($course,404);

        $user=$request->user();
        $canManage=$user && ($user->role==='admin'||($user->role==='instructor'&&(int)$course->instructor_id===(int)$user->id));
        if($course->status!=='published')abort_unless($canManage,404);
        $enrolled=$user?DB::table('enrollments')->where('user_id',$user->id)->where('course_id',$course->id)->exists():false;
        $fullAccess=$canManage||$enrolled;

        $meta=is_string($course->metadata)?json_decode($course->metadata,true):($course->metadata??[]);
        $out=[
            'id'=>$course->id,'slug'=>$course->slug,'title'=>$course->title,'category'=>$course->category,
            'subtitle'=>$course->subtitle,'description'=>$course->description,'price'=>(int)$course->price,
            'priceLabel'=>'Rs '.number_format((int)$course->price),'status'=>$course->status,
            'rating'=>(float)$course->rating,'students'=>number_format((int)$course->students_count),
            'image'=>$course->image,'badge'=>$course->badge,'learn'=>$meta['learn']??[],'modules'=>$meta['modules']??[],
            'enrolled'=>$enrolled,'can_manage'=>$canManage,
        ];

        $out['sections']=DB::table('course_sections')->where('course_id',$course->id)->orderBy('position')->get()->map(function($section)use($fullAccess){
            $lessons=DB::table('lessons')->where('course_section_id',$section->id)->orderBy('position')->get()->map(function($lesson)use($fullAccess){
                $open=$fullAccess||(bool)$lesson->is_preview;
                return [
                    'id'=>$lesson->id,'title'=>$lesson->title,'position'=>(int)$lesson->position,
                    'duration_seconds'=>$lesson->duration_seconds,'is_preview'=>(bool)$lesson->is_preview,
                    'locked'=>!$open,'content'=>$open?$lesson->content:null,'video_url'=>$open?$lesson->video_url:null,
                ];
            })->values();
            return ['id'=>$section->id,'title'=>$section->title,'position'=>(int)$section->position,'lessons'=>$lessons];
        })->values();

        return response()->json($out);
    }
}
