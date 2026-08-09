<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('payment_assets')) {
            Schema::create('payment_assets', function (Blueprint $table) {
                $table->id();
                $table->string('key', 120)->unique();
                $table->string('mime_type', 100);
                $table->string('original_name', 255)->nullable();
                $table->unsignedBigInteger('size_bytes')->default(0);
                $table->longText('content_base64');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_assets');
    }
};
