<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if(!Schema::hasTable('assessment_attempts')){
            Schema::create('assessment_attempts',function(Blueprint $table){
                $table->id();
                $table->foreignId('assessment_id')->constrained('assessment_sets')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->unsignedTinyInteger('score')->default(0);
                $table->boolean('passed')->default(false)->index();
                $table->json('answers')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
                $table->index(['user_id','assessment_id','created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('assessment_attempts');
    }
};
