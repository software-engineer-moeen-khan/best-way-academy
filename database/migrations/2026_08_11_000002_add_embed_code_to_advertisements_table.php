<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('advertisements', function (Blueprint $table) {
            $table->string('ad_type', 20)->default('image')->after('name')->index();
            $table->longText('embed_code')->nullable()->after('image_url');
            $table->text('image_url')->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('advertisements')->whereNull('image_url')->update(['image_url' => '']);

        Schema::table('advertisements', function (Blueprint $table) {
            $table->dropIndex(['ad_type']);
            $table->dropColumn(['ad_type', 'embed_code']);
            $table->text('image_url')->nullable(false)->change();
        });
    }
};
