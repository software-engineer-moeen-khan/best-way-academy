<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InstructorOverviewController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user=$request->user();
        abort_unless($user&&in_array($user->role,['admin','instructor'],true),403);

        $courseQuery=DB::table('courses');
        if($user->role==='instructor')$courseQuery->where('instructor_id',$user->id);
        $courseIds=$courseQuery->pluck('id');

        $courses=DB::table('courses as c')
            ->leftJoin('enrollments as e','e.course_id','=','c.id')
            ->whereIn('c.id',$courseIds)
            ->groupBy('c.id','c.slug','c.title','c.category','c.status','c.price','c.rating','c.image')
            ->orderByDesc(DB::raw('COUNT(e.id)'))
            ->select('c.id','c.slug','c.title','c.category','c.status','c.price','c.rating','c.image',DB::raw('COUNT(e.id) as enrollment_count'))
            ->get();

        $students=DB::table('users as u')
            ->join('enrollments as e','e.user_id','=','u.id')
            ->whereIn('e.course_id',$courseIds)
            ->groupBy('u.id','u.name','u.email')
            ->orderBy('u.name')
            ->select('u.id','u.name','u.email',DB::raw('COUNT(DISTINCT e.course_id) as enrollment_count'))
            ->limit(250)
            ->get();

        $revenue=(int)DB::table('order_items as oi')
            ->join('orders as o','o.id','=','oi.order_id')
            ->whereIn('oi.course_id',$courseIds)
            ->where('o.status','completed')
            ->sum('oi.price');

        $questions=(int)DB::table('questions')->whereIn('course_id',$courseIds)->where('status','open')->count();
        $reviews=(float)(DB::table('reviews')->whereIn('course_id',$courseIds)->where('status','published')->avg('rating')??0);

        return response()->json([
            'metrics'=>[
                'courses'=>$courseIds->count(),
                'students'=>$students->count(),
                'enrollments'=>(int)DB::table('enrollments')->whereIn('course_id',$courseIds)->count(),
                'revenue'=>$revenue,
                'average_rating'=>round($reviews,2),
                'open_questions'=>$questions,
            ],
            'courses'=>$courses,
            'students'=>$students,
        ]);
    }
}
