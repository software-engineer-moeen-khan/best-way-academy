<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminOverviewReportsController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $now = now();
        $todayStart = $now->copy()->startOfDay();
        $monthStart = $now->copy()->startOfMonth();
        $nextMonthStart = $now->copy()->addMonth()->startOfMonth();
        $lastMonthStart = $now->copy()->subMonthNoOverflow()->startOfMonth();

        $completedRevenue = (float) DB::table('orders')->where('status', 'completed')->sum('total');
        $completedOrders = (int) DB::table('orders')->where('status', 'completed')->count();
        $totalEnrollments = (int) DB::table('enrollments')->count();
        $completedEnrollments = (int) DB::table('enrollments')->whereNotNull('completed_at')->count();

        $summary = [
            'revenue_total' => $completedRevenue,
            'revenue_today' => (float) DB::table('orders')
                ->where('status', 'completed')->where('created_at', '>=', $todayStart)->sum('total'),
            'revenue_this_month' => (float) DB::table('orders')
                ->where('status', 'completed')->where('created_at', '>=', $monthStart)->sum('total'),
            'revenue_last_month' => (float) DB::table('orders')
                ->where('status', 'completed')
                ->where('created_at', '>=', $lastMonthStart)->where('created_at', '<', $monthStart)
                ->sum('total'),
            'orders_today' => (int) DB::table('orders')->where('created_at', '>=', $todayStart)->count(),
            'orders_this_month' => (int) DB::table('orders')->where('created_at', '>=', $monthStart)->count(),
            'completed_orders' => $completedOrders,
            'pending_orders' => (int) DB::table('orders')->where('status', 'pending')->count(),
            'refunded_orders' => (int) DB::table('orders')->where('status', 'refunded')->count(),
            'cancelled_orders' => (int) DB::table('orders')->where('status', 'cancelled')->count(),
            'pending_value' => (float) DB::table('orders')->where('status', 'pending')->sum('total'),
            'refunded_value' => (float) DB::table('orders')->where('status', 'refunded')->sum('total'),
            'average_order_value' => $completedOrders > 0 ? round($completedRevenue / $completedOrders, 2) : 0,
            'new_students_this_month' => (int) DB::table('users')
                ->where('role', 'student')->where('created_at', '>=', $monthStart)->count(),
            'new_enrollments_this_month' => (int) DB::table('enrollments')
                ->where('created_at', '>=', $monthStart)->count(),
            'completion_rate' => $totalEnrollments > 0 ? round(($completedEnrollments / $totalEnrollments) * 100, 1) : 0,
        ];

        $dailyStart = $now->copy()->subDays(13)->startOfDay();
        $dailyRows = DB::table('orders')
            ->where('created_at', '>=', $dailyStart)
            ->selectRaw("DATE(created_at) as report_date, COUNT(*) as orders, SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue")
            ->groupByRaw('DATE(created_at)')
            ->orderBy('report_date')
            ->get()
            ->keyBy('report_date');

        $daily = collect(range(0, 13))->map(function ($offset) use ($dailyStart, $dailyRows) {
            $day = $dailyStart->copy()->addDays($offset);
            $key = $day->toDateString();
            $row = $dailyRows->get($key);

            return [
                'date' => $key,
                'label' => $day->format('d M'),
                'orders' => (int) ($row->orders ?? 0),
                'revenue' => (float) ($row->revenue ?? 0),
            ];
        })->values();

        $statusBreakdown = DB::table('orders')
            ->selectRaw('status, COUNT(*) as orders, COALESCE(SUM(total),0) as value')
            ->groupBy('status')
            ->orderByDesc('orders')
            ->get()
            ->map(fn ($row) => [
                'status' => $row->status ?: 'unknown',
                'orders' => (int) $row->orders,
                'value' => (float) $row->value,
            ])->values();

        $paymentMethods = DB::table('orders')
            ->where('status', 'completed')
            ->selectRaw("COALESCE(NULLIF(payment_method,''),'Unknown') as payment_method, COUNT(*) as orders, COALESCE(SUM(total),0) as revenue")
            ->groupByRaw("COALESCE(NULLIF(payment_method,''),'Unknown')")
            ->orderByDesc('revenue')
            ->get()
            ->map(fn ($row) => [
                'payment_method' => $row->payment_method,
                'orders' => (int) $row->orders,
                'revenue' => (float) $row->revenue,
            ])->values();

        $topCourses = DB::table('courses as c')
            ->leftJoin('enrollments as e', 'e.course_id', '=', 'c.id')
            ->leftJoinSub(
                DB::table('order_items as oi')
                    ->join('orders as o', 'o.id', '=', 'oi.order_id')
                    ->where('o.status', 'completed')
                    ->groupBy('oi.course_id')
                    ->selectRaw('oi.course_id, COUNT(DISTINCT o.id) as completed_orders, COALESCE(SUM(oi.price),0) as item_revenue'),
                'sales',
                'sales.course_id',
                '=',
                'c.id'
            )
            ->groupBy('c.id', 'c.title', 'c.slug', 'c.status', 'sales.completed_orders', 'sales.item_revenue')
            ->selectRaw('c.id, c.title, c.slug, c.status, COUNT(DISTINCT e.id) as enrollments, COALESCE(sales.completed_orders,0) as completed_orders, COALESCE(sales.item_revenue,0) as revenue')
            ->orderByDesc('revenue')
            ->orderByDesc('enrollments')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'title' => $row->title,
                'slug' => $row->slug,
                'status' => $row->status,
                'enrollments' => (int) $row->enrollments,
                'completed_orders' => (int) $row->completed_orders,
                'revenue' => (float) $row->revenue,
            ])->values();

        $growthStart = $now->copy()->subMonthsNoOverflow(5)->startOfMonth();
        $studentRows = DB::table('users')
            ->where('role', 'student')->where('created_at', '>=', $growthStart)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month_key, COUNT(*) as students")
            ->groupByRaw("DATE_FORMAT(created_at, '%Y-%m')")
            ->pluck('students', 'month_key');
        $enrollmentRows = DB::table('enrollments')
            ->where('created_at', '>=', $growthStart)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month_key, COUNT(*) as enrollments")
            ->groupByRaw("DATE_FORMAT(created_at, '%Y-%m')")
            ->pluck('enrollments', 'month_key');
        $revenueRows = DB::table('orders')
            ->where('status', 'completed')->where('created_at', '>=', $growthStart)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month_key, COALESCE(SUM(total),0) as revenue")
            ->groupByRaw("DATE_FORMAT(created_at, '%Y-%m')")
            ->pluck('revenue', 'month_key');

        $monthlyGrowth = collect(range(0, 5))->map(function ($offset) use ($growthStart, $studentRows, $enrollmentRows, $revenueRows) {
            $month = $growthStart->copy()->addMonthsNoOverflow($offset);
            $key = $month->format('Y-m');

            return [
                'month' => $key,
                'label' => $month->format('M Y'),
                'students' => (int) ($studentRows[$key] ?? 0),
                'enrollments' => (int) ($enrollmentRows[$key] ?? 0),
                'revenue' => (float) ($revenueRows[$key] ?? 0),
            ];
        })->values();

        $settings = DB::table('platform_settings')->whereIn('key', ['currency_symbol', 'currency'])->pluck('value', 'key');

        return response()->json([
            'generated_at' => $now->toIso8601String(),
            'period' => [
                'month_start' => $monthStart->toDateString(),
                'next_month_start' => $nextMonthStart->toDateString(),
            ],
            'currency_symbol' => trim((string) ($settings['currency_symbol'] ?? 'Rs'), '"'),
            'currency' => trim((string) ($settings['currency'] ?? 'PKR'), '"'),
            'summary' => $summary,
            'daily' => $daily,
            'status_breakdown' => $statusBreakdown,
            'payment_methods' => $paymentMethods,
            'top_courses' => $topCourses,
            'monthly_growth' => $monthlyGrowth,
        ]);
    }
}
