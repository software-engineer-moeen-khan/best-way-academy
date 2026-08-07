<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('instructor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('slug',120)->unique();
            $table->string('title');
            $table->string('category',120)->index();
            $table->text('subtitle')->nullable();
            $table->longText('description')->nullable();
            $table->unsignedInteger('price')->default(0);
            $table->string('status',30)->default('published')->index();
            $table->decimal('rating',3,2)->default(0);
            $table->unsignedInteger('students_count')->default(0);
            $table->text('image')->nullable();
            $table->string('badge',80)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
        Schema::create('course_sections', function (Blueprint $table) {
            $table->id(); $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('title'); $table->unsignedInteger('position')->default(1); $table->timestamps();
        });
        Schema::create('lessons', function (Blueprint $table) {
            $table->id(); $table->foreignId('course_section_id')->constrained()->cascadeOnDelete();
            $table->string('title'); $table->longText('content')->nullable(); $table->text('video_url')->nullable();
            $table->unsignedInteger('position')->default(1); $table->unsignedInteger('duration_seconds')->nullable();
            $table->boolean('is_preview')->default(false); $table->timestamps();
        });
        Schema::create('enrollments', function (Blueprint $table) {
            $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('progress')->default(0); $table->timestamp('enrolled_at')->nullable(); $table->timestamp('completed_at')->nullable(); $table->timestamps();
            $table->unique(['user_id','course_id']);
        });
        Schema::create('lesson_progress', function (Blueprint $table) {
            $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->foreignId('lesson_id')->constrained()->cascadeOnDelete();
            $table->timestamp('completed_at')->nullable(); $table->timestamps(); $table->unique(['user_id','lesson_id']);
        });
        Schema::create('cart_items', function (Blueprint $table) {
            $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->foreignId('course_id')->constrained()->cascadeOnDelete(); $table->timestamps(); $table->unique(['user_id','course_id']);
        });
        Schema::create('wishlist_items', function (Blueprint $table) {
            $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->foreignId('course_id')->constrained()->cascadeOnDelete(); $table->timestamps(); $table->unique(['user_id','course_id']);
        });
        Schema::create('orders', function (Blueprint $table) {
            $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->string('number',64)->unique();
            $table->unsignedInteger('total')->default(0); $table->string('status',30)->default('completed'); $table->string('payment_method',50)->nullable(); $table->json('metadata')->nullable(); $table->timestamps();
        });
        Schema::create('order_items', function (Blueprint $table) {
            $table->id(); $table->foreignId('order_id')->constrained()->cascadeOnDelete(); $table->foreignId('course_id')->constrained()->restrictOnDelete(); $table->unsignedInteger('price'); $table->timestamps();
        });
        Schema::create('reviews', function (Blueprint $table) {
            $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('rating'); $table->text('body')->nullable(); $table->string('status',30)->default('published'); $table->timestamps(); $table->unique(['user_id','course_id']);
        });
        Schema::create('questions', function (Blueprint $table) {
            $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->foreignId('course_id')->constrained()->cascadeOnDelete(); $table->foreignId('lesson_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title'); $table->text('body'); $table->string('status',30)->default('open'); $table->timestamps();
        });
        Schema::create('answers', function (Blueprint $table) {
            $table->id(); $table->foreignId('question_id')->constrained()->cascadeOnDelete(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->text('body'); $table->timestamps();
        });
        Schema::create('notes', function (Blueprint $table) {
            $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->foreignId('course_id')->constrained()->cascadeOnDelete(); $table->foreignId('lesson_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body'); $table->unsignedInteger('position_seconds')->nullable(); $table->timestamps();
        });
        Schema::create('announcements', function (Blueprint $table) {
            $table->id(); $table->foreignId('course_id')->constrained()->cascadeOnDelete(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->string('title'); $table->text('body'); $table->timestamps();
        });
        Schema::create('messages', function (Blueprint $table) {
            $table->id(); $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete(); $table->foreignId('recipient_id')->constrained('users')->cascadeOnDelete();
            $table->string('subject')->nullable(); $table->text('body'); $table->timestamp('read_at')->nullable(); $table->timestamps();
        });
        Schema::create('coupons', function (Blueprint $table) {
            $table->id(); $table->foreignId('course_id')->nullable()->constrained()->cascadeOnDelete(); $table->string('code',80)->unique(); $table->string('discount_type',20)->default('percent');
            $table->unsignedInteger('discount_value'); $table->timestamp('starts_at')->nullable(); $table->timestamp('ends_at')->nullable(); $table->unsignedInteger('max_uses')->nullable(); $table->unsignedInteger('uses')->default(0); $table->boolean('active')->default(true); $table->timestamps();
        });
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->string('plan',50); $table->string('status',30)->default('active');
            $table->timestamp('starts_at')->nullable(); $table->timestamp('ends_at')->nullable(); $table->string('provider_ref')->nullable(); $table->timestamps();
        });
        Schema::create('user_states', function (Blueprint $table) {
            $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete(); $table->string('key',128); $table->json('value')->nullable(); $table->timestamps(); $table->unique(['user_id','key']);
        });
        Schema::create('global_states', function (Blueprint $table) {
            $table->id(); $table->string('key',128)->unique(); $table->json('value')->nullable(); $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['global_states','user_states','subscriptions','coupons','messages','announcements','notes','answers','questions','reviews','order_items','orders','wishlist_items','cart_items','lesson_progress','enrollments','lessons','course_sections','courses'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
