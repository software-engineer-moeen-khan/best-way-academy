<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('courses', 'course_link')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->text('course_link')->nullable()->after('badge');
            });
        }

        // Backfill links saved by the earlier platform_settings / metadata implementations.
        DB::table('courses')->orderBy('id')->get(['id', 'metadata', 'course_link'])->each(function ($course) {
            if (trim((string) ($course->course_link ?? '')) !== '') {
                return;
            }

            $stored = DB::table('platform_settings')->where('key', 'course_link_'.$course->id)->value('value');
            $link = null;

            if ($stored !== null) {
                $decoded = json_decode((string) $stored, true);
                $link = is_string($decoded) ? trim($decoded) : trim((string) $stored);
            }

            if (! $link) {
                $metadata = is_string($course->metadata ?? null)
                    ? (json_decode((string) $course->metadata, true) ?: [])
                    : ((array) ($course->metadata ?? []));
                $link = trim((string) ($metadata['course_link'] ?? ''));
            }

            if ($link !== '') {
                DB::table('courses')->where('id', $course->id)->update(['course_link' => $link]);
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('courses', 'course_link')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->dropColumn('course_link');
            });
        }
    }
};
