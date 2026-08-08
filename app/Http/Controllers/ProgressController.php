<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProgressController extends Controller
{
    public function sync(Request $request,string $slug): JsonResponse
    {
        $data=$request->validate([
            'completed_positions'=>['required','array','max:10000'],
            'completed_positions.*'=>['integer','min:0'],
        ]);

        $user=$request->user();
        $course=DB::table('courses')->where('slug',$slug)->first();
        abort_unless($course,404);
        $enrollment=DB::table('enrollments')->where('user_id',$user->id)->where('course_id',$course->id)->first();
        abort_unless($enrollment,403,'Enroll in this course first.');

        $lessons=DB::table('lessons as l')
            ->join('course_sections as s','s.id','=','l.course_section_id')
            ->where('s.course_id',$course->id)
            ->orderBy('s.position')->orderBy('l.position')->select('l.id')->get()->values();

        DB::transaction(function()use($user,$lessons,$data){
            foreach(array_unique($data['completed_positions']) as $position){
                $lesson=$lessons->get((int)$position);if(!$lesson)continue;
                DB::table('lesson_progress')->updateOrInsert(
                    ['user_id'=>$user->id,'lesson_id'=>$lesson->id],
                    ['completed_at'=>now(),'updated_at'=>now()]
                );
            }
        });

        $lessonIds=$lessons->pluck('id');
        $done=$lessonIds->isEmpty()?0:DB::table('lesson_progress')->where('user_id',$user->id)->whereIn('lesson_id',$lessonIds)->whereNotNull('completed_at')->count();
        $progress=$lessons->isEmpty()?0:min(100,(int)round($done/$lessons->count()*100));
        DB::table('enrollments')->where('id',$enrollment->id)->update([
            'progress'=>$progress,
            'completed_at'=>$progress>=100?($enrollment->completed_at?:now()):$enrollment->completed_at,
            'updated_at'=>now(),
        ]);

        return response()->json(['progress'=>$progress,'completed_lessons'=>$done,'total_lessons'=>$lessons->count()]);
    }
}
