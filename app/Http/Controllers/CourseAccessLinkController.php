<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class CourseAccessLinkController extends Controller
{
    private function settingKey(int $courseId): string
    {
        return 'course_link_'.$courseId;
    }

    private function hasLinkColumn(): bool
    {
        return Schema::hasColumn('courses', 'course_link');
    }

    private function hasAccessTable(): bool
    {
        return Schema::hasTable('course_access_links');
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
        if ($this->hasAccessTable()) {
            $dedicated = trim((string) DB::table('course_access_links')
                ->where('course_id', (int) $course->id)
                ->value('url'));
            if ($dedicated !== '') {
                return $this->safeStoredLink($dedicated);
            }
        }

        $direct = trim((string) ($course->course_link ?? ''));
        if ($direct !== '') {
            return $this->safeStoredLink($direct);
        }

        $value = DB::table('platform_settings')
            ->where('key', $this->settingKey((int) $course->id))
            ->value('value');

        if ($value !== null) {
            $decoded = json_decode((string) $value, true);
            $link = is_string($decoded) ? trim($decoded) : trim((string) $value);
            $safe = $this->safeStoredLink($link);
            if ($safe) {
                return $safe;
            }
        }

        $meta = $this->metadata($course);
        return $this->safeStoredLink(trim((string) ($meta['course_link'] ?? '')));
    }

    private function safeStoredLink(?string $value): ?string
    {
        try {
            return $this->cleanLink($value);
        } catch (ValidationException) {
            return null;
        }
    }

    private function cleanLink(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        if (mb_strlen($value) > 2048 || preg_match('/[\x00-\x1F\x7F]/u', $value)) {
            throw ValidationException::withMessages(['course_link' => 'Enter a valid course link.']);
        }

        if (preg_match('/^(javascript|data|vbscript|file|about):/i', $value)) {
            throw ValidationException::withMessages(['course_link' => 'This link type is not allowed.']);
        }

        if (str_starts_with($value, '/') || str_starts_with($value, '#') || str_starts_with($value, '?')) {
            return $value;
        }

        if (preg_match('/^([a-z][a-z0-9+.-]*):/i', $value, $match)) {
            $scheme = strtolower($match[1]);
            if (in_array($scheme, ['http', 'https'], true) && ! filter_var($value, FILTER_VALIDATE_URL)) {
                throw ValidationException::withMessages(['course_link' => 'Enter a valid web link.']);
            }
            return $value;
        }

        if (preg_match('/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d{1,5})?(?:[\/?#].*)?$/i', $value)) {
            $normalized = 'https://'.$value;
            if (filter_var($normalized, FILTER_VALIDATE_URL)) {
                return $normalized;
            }
        }

        throw ValidationException::withMessages([
            'course_link' => 'Enter a web link, internal path, or supported app/deep link.',
        ]);
    }

    private function courseSelectColumns(string $prefix = 'c.'): array
    {
        $columns = [$prefix.'id', $prefix.'slug', $prefix.'title', $prefix.'metadata'];
        if ($this->hasLinkColumn()) {
            $columns[] = $prefix.'course_link';
        }
        return $columns;
    }

    public function learner(Request $request): JsonResponse
    {
        $columns = array_merge(
            $this->courseSelectColumns(),
            ['e.progress', 'e.enrolled_at', 'e.created_at as enrollment_created_at']
        );

        $rows = DB::table('enrollments as e')
            ->join('courses as c', 'c.id', '=', 'e.course_id')
            ->where('e.user_id', $request->user()->id)
            ->orderByDesc('e.updated_at')
            ->select($columns)
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

        $columns = ['id', 'slug', 'title', 'metadata'];
        if ($this->hasLinkColumn()) {
            $columns[] = 'course_link';
        }

        $links = DB::table('courses')->orderBy('id')->get($columns)->mapWithKeys(function ($course) {
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

        DB::transaction(function () use ($course, $link) {
            if ($this->hasAccessTable()) {
                if ($link === null) {
                    DB::table('course_access_links')->where('course_id', $course)->delete();
                } else {
                    $existing = DB::table('course_access_links')->where('course_id', $course)->exists();
                    DB::table('course_access_links')->updateOrInsert(
                        ['course_id' => $course],
                        [
                            'url' => $link,
                            'updated_at' => now(),
                            'created_at' => $existing ? DB::raw('created_at') : now(),
                        ]
                    );
                }
            }

            if ($this->hasLinkColumn()) {
                DB::table('courses')->where('id', $course)->update([
                    'course_link' => $link,
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('courses')->where('id', $course)->update(['updated_at' => now()]);
            }

            $key = $this->settingKey($course);
            if ($link === null) {
                DB::table('platform_settings')->where('key', $key)->delete();
            } else {
                $existingSetting = DB::table('platform_settings')->where('key', $key)->exists();
                DB::table('platform_settings')->updateOrInsert(
                    ['key' => $key],
                    [
                        'value' => json_encode($link, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                        'updated_at' => now(),
                        'created_at' => $existingSetting ? DB::raw('created_at') : now(),
                    ]
                );
            }
        });

        $columns = ['id', 'slug', 'title', 'metadata'];
        if ($this->hasLinkColumn()) {
            $columns[] = 'course_link';
        }
        $savedCourse = DB::table('courses')->where('id', $course)->first($columns);
        $saved = $savedCourse ? $this->storedLink($savedCourse) : null;

        return response()->json([
            'ok' => true,
            'course_id' => $course,
            'course_link' => $saved,
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
}
