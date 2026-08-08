<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->index(['user_id','created_at']);
            $table->index(['status','created_at']);
        });
        Schema::table('messages', function (Blueprint $table) {
            $table->index(['sender_id','created_at']);
            $table->index(['recipient_id','created_at']);
        });
        Schema::table('questions', function (Blueprint $table) {
            $table->index(['course_id','created_at']);
            $table->index(['course_id','status']);
        });
        Schema::table('reviews', function (Blueprint $table) {
            $table->index(['course_id','status','created_at']);
        });
        Schema::table('announcements', function (Blueprint $table) {
            $table->index(['course_id','created_at']);
        });
        Schema::table('coupons', function (Blueprint $table) {
            $table->index(['active','starts_at','ends_at']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['user_id','created_at']);
            $table->dropIndex(['status','created_at']);
        });
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex(['sender_id','created_at']);
            $table->dropIndex(['recipient_id','created_at']);
        });
        Schema::table('questions', function (Blueprint $table) {
            $table->dropIndex(['course_id','created_at']);
            $table->dropIndex(['course_id','status']);
        });
        Schema::table('reviews', function (Blueprint $table) {
            $table->dropIndex(['course_id','status','created_at']);
        });
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropIndex(['course_id','created_at']);
        });
        Schema::table('coupons', function (Blueprint $table) {
            $table->dropIndex(['active','starts_at','ends_at']);
        });
    }
};
