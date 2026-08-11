<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FreeCourseController extends Controller
{
    private function courseBySlug(string $slug): object
    {
        $course=DB::table('courses')->where('slug',$slug)->first();
        abort_unless($course&&$course->status==='published',404);
        return $course;
    }

    public function status(Request $request,string $slug): JsonResponse
    {
        $course=$this->courseBySlug($slug);
        $isFree=(bool)($course->is_free??false);
        $enrolled=false;
        if($request->user()){
            $enrolled=DB::table('enrollments')->where('user_id',$request->user()->id)->where('course_id',$course->id)->exists();
        }

        return response()->json([
            'course_id'=>(int)$course->id,
            'slug'=>$course->slug,
            'is_free'=>$isFree,
            'price'=>(int)$course->price,
            'enrolled'=>$enrolled,
        ])->header('Cache-Control','no-cache, no-store, must-revalidate');
    }

    public function enroll(Request $request,string $slug): JsonResponse
    {
        $user=$request->user();
        abort_unless($user,401);
        abort_unless($user->role==='student',403,'Only learner accounts can enroll in courses.');

        $course=$this->courseBySlug($slug);
        abort_unless((bool)($course->is_free??false),422,'This course is not free.');

        $created=false;
        DB::transaction(function()use($user,$course,&$created): void {
            $created=DB::table('enrollments')->insertOrIgnore([
                'user_id'=>$user->id,
                'course_id'=>$course->id,
                'progress'=>0,
                'enrolled_at'=>now(),
                'created_at'=>now(),
                'updated_at'=>now(),
            ])===1;

            if($created){
                DB::table('courses')->where('id',$course->id)->increment('students_count');
                DB::table('cart_items')->where('user_id',$user->id)->where('course_id',$course->id)->delete();
            }
        });

        return response()->json([
            'ok'=>true,
            'enrolled'=>true,
            'created'=>$created,
            'course_id'=>(int)$course->id,
            'slug'=>$course->slug,
            'redirect'=>'/my-learning',
        ])->header('Cache-Control','no-store, no-cache, must-revalidate');
    }

    public function adminIndex(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);
        $statuses=DB::table('courses')->orderBy('id')->get(['id','is_free','price'])->mapWithKeys(fn($course)=>[
            (string)$course->id=>[
                'is_free'=>(bool)($course->is_free??false),
                'price'=>(int)$course->price,
            ],
        ]);

        return response()->json(['courses'=>$statuses])
            ->header('Cache-Control','no-store, no-cache, must-revalidate');
    }

    public function adminUpdate(Request $request,int $course): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);
        abort_unless(DB::table('courses')->where('id',$course)->exists(),404);
        $data=$request->validate(['is_free'=>['required','boolean']]);
        $isFree=(bool)$data['is_free'];

        $update=['is_free'=>$isFree,'updated_at'=>now()];
        if($isFree)$update['price']=0;
        DB::table('courses')->where('id',$course)->update($update);

        $saved=DB::table('courses')->where('id',$course)->first(['id','is_free','price']);
        return response()->json([
            'ok'=>true,
            'course'=>[
                'id'=>(int)$saved->id,
                'is_free'=>(bool)$saved->is_free,
                'price'=>(int)$saved->price,
            ],
        ])->header('Cache-Control','no-store, no-cache, must-revalidate');
    }
}
