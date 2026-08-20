<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Throwable;

class UdemyEnglishCourseCleaner
{
    private const ENGLISH = ['english', 'en', 'en-us', 'en-gb'];

    private const NON_ENGLISH = [
        'spanish', 'espanol', 'español', 'german', 'deutsch', 'arabic', 'french', 'francais', 'français',
        'italian', 'italiano', 'portuguese', 'portugues', 'português', 'russian', 'turkish', 'japanese',
        'korean', 'hindi', 'urdu', 'chinese', 'mandarin', 'polish', 'dutch', 'indonesian', 'vietnamese',
        'thai', 'bengali', 'greek', 'hebrew', 'czech', 'romanian', 'hungarian', 'persian', 'farsi',
        'ukrainian', 'tamil', 'telugu', 'malay', 'swedish', 'norwegian', 'danish', 'finnish',
    ];

    public function cleanup(?callable $progress = null): array
    {
        $result = [
            'checked' => 0,
            'english' => 0,
            'removed' => 0,
            'archived' => 0,
            'unverified' => 0,
        ];

        if (! Schema::hasTable('courses')) {
            return $result;
        }

        DB::table('courses')
            ->where('badge', 'Udemy 100% OFF')
            ->orderBy('id')
            ->chunkById(50, function ($courses) use (&$result, $progress): void {
                foreach ($courses as $course) {
                    $result['checked']++;
                    $metadata = $this->decodeMetadata($course->metadata ?? null);

                    if (($metadata['external_provider'] ?? null) !== 'udemy') {
                        continue;
                    }

                    $sourceUrl = trim((string) ($metadata['source_url'] ?? ''));
                    $language = $this->languageFromSourceUrl($sourceUrl);

                    if ($language === null && $sourceUrl !== '') {
                        $language = $this->languageFromSourcePage($sourceUrl);
                    }

                    if ($language === 'english') {
                        $result['english']++;
                        $this->persistLanguage((int) $course->id, $metadata, 'English');
                        continue;
                    }

                    $title = trim((string) ($course->title ?? 'Udemy course'));
                    if ($language === null) {
                        $result['unverified']++;
                    }

                    if ($this->removeCourse((int) $course->id)) {
                        $result['removed']++;
                        $reason = $language === 'non_english' ? 'non-English' : 'unverified-language';
                        $progress && $progress("Removed {$reason} course: {$title}");
                    } else {
                        $result['archived']++;
                        $progress && $progress("Archived non-English/unverified course with order history: {$title}");
                    }
                }
            }, 'id');

        return $result;
    }

    private function languageFromSourceUrl(string $url): ?string
    {
        if ($url === '') {
            return null;
        }

        $path = trim((string) (parse_url($url, PHP_URL_PATH) ?? ''), '/');
        if ($path === '') {
            return null;
        }

        $segments = array_values(array_filter(explode('/', rawurldecode($path))));
        if ($segments === []) {
            return null;
        }

        return $this->classifyLanguageLabel($segments[0]);
    }

    private function languageFromSourcePage(string $url): ?string
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (compatible; BestWayAcademyLanguageCleaner/1.0)',
                'Accept' => 'text/html,application/xhtml+xml',
                'Accept-Language' => 'en-US,en;q=0.9',
            ])
                ->withOptions(['allow_redirects' => true])
                ->timeout(12)
                ->retry(1, 300, throw: false)
                ->get($url);

            if (! $response->successful()) {
                return null;
            }

            $text = html_entity_decode(strip_tags($response->body()), ENT_QUOTES | ENT_HTML5);
            $text = preg_replace('/\s+/u', ' ', $text) ?: $text;

            if (preg_match('/Course\s+Language\s*:\s*([\p{L}\- ]{2,40})/iu', $text, $match)) {
                return $this->classifyLanguageLabel(trim($match[1]));
            }
        } catch (Throwable) {
            return null;
        }

        return null;
    }

    private function classifyLanguageLabel(string $label): ?string
    {
        $label = mb_strtolower(trim($label));
        $label = trim((string) preg_replace('/\s+/u', ' ', $label));

        if ($label === '') {
            return null;
        }

        foreach (self::ENGLISH as $english) {
            if ($label === $english || str_starts_with($label, $english.' ')) {
                return 'english';
            }
        }

        foreach (self::NON_ENGLISH as $language) {
            if ($label === $language || str_starts_with($label, $language.' ')) {
                return 'non_english';
            }
        }

        return null;
    }

    private function removeCourse(int $courseId): bool
    {
        $hasOrderHistory = Schema::hasTable('order_items')
            && DB::table('order_items')->where('course_id', $courseId)->exists();

        if ($hasOrderHistory) {
            DB::table('courses')->where('id', $courseId)->update([
                'status' => 'archived',
                'updated_at' => now(),
            ]);

            return false;
        }

        DB::transaction(function () use ($courseId): void {
            if (Schema::hasTable('platform_settings')) {
                DB::table('platform_settings')->where('key', 'course_link_'.$courseId)->delete();
            }

            DB::table('courses')->where('id', $courseId)->delete();
        });

        return true;
    }

    private function persistLanguage(int $courseId, array $metadata, string $language): void
    {
        if (($metadata['language'] ?? null) === $language) {
            return;
        }

        $metadata['language'] = $language;

        DB::table('courses')->where('id', $courseId)->update([
            'metadata' => json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ]);
    }

    private function decodeMetadata(mixed $metadata): array
    {
        if (is_array($metadata)) {
            return $metadata;
        }

        if (! is_string($metadata) || $metadata === '') {
            return [];
        }

        $decoded = json_decode($metadata, true);
        return is_array($decoded) ? $decoded : [];
    }
}
