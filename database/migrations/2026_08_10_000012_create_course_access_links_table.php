<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('course_access_links')) {
            Schema::create('course_access_links', function (Blueprint $table) {
                $table->id();
                $table->foreignId('course_id')->unique()->constrained('courses')->cascadeOnDelete();
                $table->text('url');
                $table->timestamps();
            });
        }

        // Backfill any links saved by earlier implementations.
        DB::table('courses')->orderBy('id')->get()->each(function ($course) {
            $link = trim((string) ($course->course_link ?? ''));

            if ($link === '') {
                $stored = DB::table('platform_settings')->where('key', 'course_link_'.$course->id)->value('value');
                if ($stored !== null) {
                    $decoded = json_decode((string) $stored, true);
                    $link = is_string($decoded) ? trim($decoded) : trim((string) $stored);
                }
            }

            if ($link === '') {
                $meta = is_string($course->metadata ?? null)
                    ? (json_decode((string) $course->metadata, true) ?: [])
                    : ((array) ($course->metadata ?? []));
                $link = trim((string) ($meta['course_link'] ?? ''));
            }

            if ($link !== '') {
                DB::table('course_access_links')->updateOrInsert(
                    ['course_id' => $course->id],
                    ['url' => $link, 'created_at' => now(), 'updated_at' => now()]
                );
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_access_links');
    }
};
