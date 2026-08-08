<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LearningContentController extends Controller
{
    public function plans(): JsonResponse
    {
        $plans=DB::table('learning_plans')->where('active',true)->orderBy('position')->orderBy('name')->get()->map(fn($p)=>[
            'id'=>$p->id,'name'=>$p->name,'slug'=>$p->slug,'billing_period'=>$p->billing_period,'price'=>(int)$p->price,
            'description'=>$p->description,'features'=>is_string($p->features)?(json_decode($p->features,true)?:[]):($p->features??[]),
        ]);
        return response()->json($plans);
    }

    private function canAccess(Request $request,object $course): bool
    {
        $user=$request->user();if(!$user)return false;
        if($user->role==='admin'||($user->role==='instructor'&&(int)$course->instructor_id===(int)$user->id))return true;
        return DB::table('enrollments')->where('user_id',$user->id)->where('course_id',$course->id)->exists();
    }

    public function assessments(Request $request,string $slug): JsonResponse
    {
        $course=DB::table('courses')->where('slug',$slug)->first();abort_unless($course,404);abort_unless($this->canAccess($request,$course),403,'Enroll in this course first.');
        $sets=DB::table('assessment_sets')->where('course_id',$course->id)->where('active',true)->orderBy('position')->get()->map(function($set)use($request){
            $questions=DB::table('assessment_questions')->where('assessment_id',$set->id)->orderBy('position')->get()->map(fn($q)=>[
                'id'=>$q->id,'prompt'=>$q->prompt,'options'=>is_string($q->options)?(json_decode($q->options,true)?:[]):($q->options??[]),'position'=>(int)$q->position,
            ])->values();
            $best=(int)(DB::table('assessment_attempts')->where('assessment_id',$set->id)->where('user_id',$request->user()->id)->max('score')??0);
            return ['id'=>$set->id,'title'=>$set->title,'type'=>$set->type,'instructions'=>$set->instructions,'passing_score'=>(int)$set->passing_score,'questions'=>$questions,'best_score'=>$best];
        })->values();
        return response()->json(['course'=>['slug'=>$course->slug,'title'=>$course->title],'assessments'=>$sets]);
    }

    public function submitAssessment(Request $request,int $assessment): JsonResponse
    {
        $set=DB::table('assessment_sets')->where('id',$assessment)->where('active',true)->first();abort_unless($set,404);
        $course=DB::table('courses')->where('id',$set->course_id)->first();abort_unless($course&&$this->canAccess($request,$course),403,'Enroll in this course first.');
        abort_unless($set->type==='test',422,'Only knowledge tests are submitted for automatic scoring.');
        $data=$request->validate(['answers'=>['required','array','max:100']]);
        $questions=DB::table('assessment_questions')->where('assessment_id',$set->id)->orderBy('position')->get();abort_if($questions->isEmpty(),422,'This assessment has no questions.');
        $correct=0;$details=[];
        foreach($questions as $q){
            $answer=trim((string)($data['answers'][(string)$q->id]??$data['answers'][$q->id]??''));$expected=trim((string)($q->correct_answer??''));
            $ok=$expected!==''&&mb_strtolower($answer)===mb_strtolower($expected);if($ok)$correct++;
            $details[(string)$q->id]=['answer'=>$answer,'correct'=>$ok];
        }
        $score=(int)round($correct/max(1,$questions->count())*100);$passed=$score>=(int)$set->passing_score;
        DB::table('assessment_attempts')->insert(['assessment_id'=>$set->id,'user_id'=>$request->user()->id,'score'=>$score,'passed'=>$passed,'answers'=>json_encode($details,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),'completed_at'=>now(),'created_at'=>now(),'updated_at'=>now()]);
        return response()->json(['score'=>$score,'passed'=>$passed,'passing_score'=>(int)$set->passing_score]);
    }
}
