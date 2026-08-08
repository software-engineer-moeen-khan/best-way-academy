<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('sessions')) {
            Schema::create('sessions', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->foreignId('user_id')->nullable()->index();
                $table->string('ip_address',45)->nullable();
                $table->text('user_agent')->nullable();
                $table->longText('payload');
                $table->integer('last_activity')->index();
            });
        }

        if (!Schema::hasTable('auth_attempts')) {
            Schema::create('auth_attempts', function (Blueprint $table) {
                $table->id();
                $table->string('key_hash',64)->index();
                $table->string('kind',20)->index();
                $table->timestamp('attempted_at')->index();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('auth_attempts');
        Schema::dropIfExists('sessions');
    }
};
