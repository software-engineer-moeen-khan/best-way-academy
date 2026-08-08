<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if(!Schema::hasTable('learning_plans')){
            Schema::create('learning_plans',function(Blueprint $table){
                $table->id();
                $table->string('name',120);
                $table->string('slug',120)->unique();
                $table->string('billing_period',30)->default('monthly');
                $table->unsignedInteger('price')->default(0);
                $table->text('description')->nullable();
                $table->json('features')->nullable();
                $table->boolean('active')->default(true)->index();
                $table->unsignedInteger('position')->default(0);
                $table->timestamps();
            });
            DB::table('learning_plans')->insert([
                ['name'=>'Monthly','slug'=>'monthly','billing_period'=>'monthly','price'=>2499,'description'=>'Flexible access for focused learning.','features'=>json_encode(['Subscription course catalog','Practice tests','Coding exercises','Labs & projects','Certificates']),'active'=>true,'position'=>1,'created_at'=>now(),'updated_at'=>now()],
                ['name'=>'Annual','slug'=>'annual','billing_period'=>'annual','price'=>19999,'description'=>'Build skills consistently throughout the year.','features'=>json_encode(['Everything in Monthly','Career learning paths','Priority new-course access','Learning assistant','Saved progress']),'active'=>true,'position'=>2,'created_at'=>now(),'updated_at'=>now()],
            ]);
        }

        if(!Schema::hasTable('assessment_sets')){
            Schema::create('assessment_sets',function(Blueprint $table){
                $table->id();
                $table->foreignId('course_id')->constrained()->cascadeOnDelete();
                $table->string('title',255);
                $table->string('type',30)->default('test')->index();
                $table->text('instructions')->nullable();
                $table->unsignedTinyInteger('passing_score')->default(70);
                $table->boolean('active')->default(true)->index();
                $table->unsignedInteger('position')->default(0);
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }
        if(!Schema::hasTable('assessment_questions')){
            Schema::create('assessment_questions',function(Blueprint $table){
                $table->id();
                $table->foreignId('assessment_id')->constrained('assessment_sets')->cascadeOnDelete();
                $table->text('prompt');
                $table->json('options')->nullable();
                $table->string('correct_answer',500)->nullable();
                $table->text('explanation')->nullable();
                $table->unsignedInteger('position')->default(0);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('assessment_questions');
        Schema::dropIfExists('assessment_sets');
        Schema::dropIfExists('learning_plans');
    }
};
