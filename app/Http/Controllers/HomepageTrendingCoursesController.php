<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HomepageTrendingCoursesController extends Controller
{
    private const SETTING_KEY = 'homepage_trending_course_ids';

    private function admin(Request $request): User
    {
        $user = $request->user();
        abort_unless($user?->role === 'admin', 403);
        return $user;
    }

    private function publishedCourses()
    {
        return DB::table('courses')
            ->where('status', 'published')
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->get([
                'id', 'slug', 'title', 'category', 'subtitle', 'price', 'rating',
                'students_count', 'image', 'badge', 'updated_at',
            ]);
    }

    private function selectedIds($courses): array
    {
        $stored = DB::table('platform_settings')->where('key', self::SETTING_KEY)->value('value');
        if ($stored === null) {
            return $courses->take(4)->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        $decoded = is_string($stored) ? json_decode($stored, true) : $stored;
        if (!is_array($decoded)) {
            return $courses->take(4)->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        $publishedIds = $courses->pluck('id')->map(fn ($id) => (int) $id)->all();
        $ids = [];
        foreach ($decoded as $raw) {
            $id = (int) $raw;
            if ($id > 0 && in_array($id, $publishedIds, true) && !in_array($id, $ids, true)) {
                $ids[] = $id;
            }
            if (count($ids) >= 4) {
                break;
            }
        }

        return $ids;
    }

    private function effectiveCourses($courses): array
    {
        $selectedIds = $this->selectedIds($courses);
        $byId = $courses->keyBy(fn ($course) => (int) $course->id);
        $ordered = [];
        $seen = [];

        foreach ($selectedIds as $id) {
            $course = $byId->get((int) $id);
            if ($course) {
                $ordered[] = $course;
                $seen[(int) $course->id] = true;
            }
        }

        foreach ($courses as $course) {
            if (count($ordered) >= 4) {
                break;
            }
            $id = (int) $course->id;
            if (!isset($seen[$id])) {
                $ordered[] = $course;
                $seen[$id] = true;
            }
        }

        return array_map(fn ($course) => $this->payload($course), $ordered);
    }

    private function payload(object $course): array
    {
        return [
            'id' => (int) $course->id,
            'slug' => (string) $course->slug,
            'title' => (string) $course->title,
            'category' => (string) $course->category,
            'subtitle' => (string) ($course->subtitle ?? ''),
            'price' => (int) $course->price,
            'rating' => (float) $course->rating,
            'students' => number_format((int) $course->students_count),
            'image' => $course->image,
            'badge' => $course->badge,
            'updated_at' => $course->updated_at,
        ];
    }

    public function publicIndex(): JsonResponse
    {
        $courses = $this->publishedCourses();
        $currency = DB::table('platform_settings')->where('key', 'currency_symbol')->value('value');
        $currency = is_string($currency) ? trim($currency, "\"' ") : '';

        return response()->json([
            'courses' => $this->effectiveCourses($courses),
            'currency_symbol' => $currency !== '' ? $currency : 'Rs',
        ])->header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    public function show(Request $request): JsonResponse
    {
        $this->admin($request);
        $courses = $this->publishedCourses();

        return response()->json([
            'courses' => $courses->map(fn ($course) => $this->payload($course))->values(),
            'selected_ids' => $this->selectedIds($courses),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate([
            'course_ids' => ['required', 'array', 'min:1', 'max:4'],
            'course_ids.*' => ['required', 'integer', 'distinct'],
        ]);

        $ids = array_values(array_map('intval', $data['course_ids']));
        $validCount = DB::table('courses')
            ->where('status', 'published')
            ->whereIn('id', $ids)
            ->count();
        abort_unless($validCount === count($ids), 422, 'Choose only published courses.');

        $value = json_encode($ids, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $now = now();
        $exists = DB::table('platform_settings')->where('key', self::SETTING_KEY)->exists();

        if ($exists) {
            DB::table('platform_settings')->where('key', self::SETTING_KEY)->update([
                'value' => $value,
                'updated_at' => $now,
            ]);
        } else {
            DB::table('platform_settings')->insert([
                'key' => self::SETTING_KEY,
                'value' => $value,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        return response()->json(['ok' => true, 'selected_ids' => $ids]);
    }
}
