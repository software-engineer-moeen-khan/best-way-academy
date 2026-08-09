<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CourseAccessLinkController extends Controller
{
    private function settingKey(int $courseId): string
    {
        return 'course_link_'.$courseId;
    }

    private function metadata(object $course): array
    {
        if (is_array($course->metadata ?? null)) {
            return $course->metadata;
        }

        $decoded = json_decode((string) ($course->metadata ?? ''), true);
        return is_array($decoded) ? $decoded : [];
    }

    private function storedLink(object $course): ?string
    {
        $value = DB::table('platform_settings')
            ->where('key', $this->settingKey((int) $course->id))
            ->value('value');

        if ($value !== null) {
            $decoded = json_decode((string) $value, true);
            $link = is_string($decoded) ? trim($decoded) : trim((string) $value);
            return $link !== '' ? $link : null;
        }

        // Backward compatibility for links saved by the earlier metadata-based implementation.
        $meta = $this->metadata($course);
        $legacy = trim((string) ($meta['course_link'] ?? ''));
        return $legacy !== '' ? $legacy : null;
    }

    private function cleanLink(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        if (mb_strlen($value) > 2048 || ! filter_var($value, FILTER_VALIDATE_URL)) {
            throw ValidationException::withMessages(['course_link' => 'Enter a valid course URL.']);
        }

        $scheme = strtolower((string) parse_url($value, PHP_URL_SCHEME));
        if (! in_array($scheme, ['http', 'https'], true)) {
            throw ValidationException::withMessages(['course_link' => 'Course link must start with http:// or https://.']);
        }

        return $value;
    }

    public function learner(Request $request): JsonResponse
    {
        $rows = DB::table('enrollments as e')
            ->join('courses as c', 'c.id', '=', 'e.course_id')
            ->where('e.user_id', $request->user()->id)
            ->orderByDesc('e.updated_at')
            ->select('c.id', 'c.slug', 'c.title', 'c.metadata', 'e.progress', 'e.enrolled_at', 'e.created_at as enrollment_created_at')
            ->get()
            ->map(function ($course) {
                return [
                    'id' => (int) $course->id,
                    'slug' => $course->slug,
                    'title' => $course->title,
                    'course_link' => $this->storedLink($course),
                    'progress' => (int) ($course->progress ?? 0),
                    'enrolled_at' => $course->enrolled_at ?: $course->enrollment_created_at,
                ];
            })
            ->values();

        return response()->json(['courses' => $rows])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate');
    }

    public function adminIndex(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $links = DB::table('courses')->orderBy('id')->get(['id', 'metadata'])->mapWithKeys(function ($course) {
            return [(string) $course->id => $this->storedLink($course)];
        });

        return response()->json(['links' => $links])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate');
    }

    public function adminUpdate(Request $request, int $course): JsonResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $row = DB::table('courses')->where('id', $course)->first();
        abort_unless($row, 404);

        $data = $request->validate([
            'course_link' => ['nullable', 'string', 'max:2048'],
        ]);

        $link = $this->cleanLink($data['course_link'] ?? null);
        $key = $this->settingKey($course);

        if ($link === null) {
            DB::table('platform_settings')->where('key', $key)->delete();
        } else {
            DB::table('platform_settings')->updateOrInsert(
                ['key' => $key],
                [
                    'value' => json_encode($link, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        return response()->json([
            'ok' => true,
            'course_id' => $course,
            'course_link' => $link,
        ]);
    }
}
