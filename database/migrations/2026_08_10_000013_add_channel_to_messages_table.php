<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('messages') && ! Schema::hasColumn('messages', 'channel')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->string('channel', 30)->nullable()->index()->after('recipient_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('messages') && Schema::hasColumn('messages', 'channel')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->dropIndex(['channel']);
                $table->dropColumn('channel');
            });
        }
    }
};
