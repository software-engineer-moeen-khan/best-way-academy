<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminOverviewController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role==='admin',403);

        $students=DB::table('users as u')
            ->leftJoin('enrollments as e','e.user_id','=','u.id')
            ->where('u.role','student')
            ->groupBy('u.id','u.name','u.email','u.created_at')
            ->orderByDesc('u.created_at')
            ->limit(250)
            ->select('u.id','u.name','u.email','u.created_at',DB::raw('COUNT(e.id) as enrollment_count'))
            ->get();

        $orders=DB::table('orders as o')
            ->join('users as u','u.id','=','o.user_id')
            ->leftJoin('order_items as oi','oi.order_id','=','o.id')
            ->groupBy('o.id','o.number','o.total','o.status','o.payment_method','o.created_at','u.name','u.email')
            ->orderByDesc('o.created_at')
            ->limit(250)
            ->select('o.id','o.number','o.total','o.status','o.payment_method','o.created_at','u.name as customer_name','u.email as customer_email',DB::raw('COUNT(oi.id) as item_count'))
            ->get();

        $courses=DB::table('courses as c')
            ->leftJoin('enrollments as e','e.course_id','=','c.id')
            ->groupBy('c.id','c.slug','c.title','c.category','c.status','c.price','c.rating','c.image')
            ->orderByDesc(DB::raw('COUNT(e.id)'))
            ->select('c.id','c.slug','c.title','c.category','c.status','c.price','c.rating','c.image',DB::raw('COUNT(e.id) as enrollment_count'))
            ->get();

        return response()->json([
            'metrics'=>[
                'courses'=>(int)DB::table('courses')->count(),
                'students'=>(int)DB::table('users')->where('role','student')->count(),
                'enrollments'=>(int)DB::table('enrollments')->count(),
                'orders'=>(int)DB::table('orders')->count(),
                'revenue'=>(int)DB::table('orders')->where('status','completed')->sum('total'),
                'open_support'=>(int)DB::table('support_requests')->whereIn('status',['open','in_progress'])->count(),
            ],
            'courses'=>$courses,
            'students'=>$students,
            'orders'=>$orders,
        ]);
    }
}
