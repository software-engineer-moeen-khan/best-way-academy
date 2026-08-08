<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('users','status')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('status',30)->default('active')->index()->after('role');
            });
        }

        if (!Schema::hasTable('course_categories')) {
            Schema::create('course_categories', function (Blueprint $table) {
                $table->id();
                $table->string('name',120)->unique();
                $table->string('slug',140)->unique();
                $table->text('description')->nullable();
                $table->string('icon',80)->nullable();
                $table->boolean('active')->default(true)->index();
                $table->unsignedInteger('position')->default(0);
                $table->timestamps();
            });

            $names=DB::table('courses')->whereNotNull('category')->where('category','!=','')->distinct()->pluck('category')->all();
            $defaults=['Development','Artificial Intelligence','Data','Marketing','Career'];
            $names=array_values(array_unique(array_merge($defaults,$names)));
            foreach($names as $index=>$name){
                $base=Str::slug($name)?:'category';
                $slug=$base;$suffix=2;
                while(DB::table('course_categories')->where('slug',$slug)->exists())$slug=$base.'-'.$suffix++;
                DB::table('course_categories')->insert([
                    'name'=>$name,'slug'=>$slug,'active'=>true,'position'=>$index+1,
                    'created_at'=>now(),'updated_at'=>now(),
                ]);
            }
        }

        if (!Schema::hasTable('platform_settings')) {
            Schema::create('platform_settings', function (Blueprint $table) {
                $table->id();
                $table->string('key',120)->unique();
                $table->json('value')->nullable();
                $table->timestamps();
            });

            $settings=[
                'site_name'=>'Best Way Academy',
                'support_email'=>'support@example.com',
                'currency'=>'PKR',
                'currency_symbol'=>'Rs',
                'allow_registration'=>true,
                'default_course_status'=>'draft',
            ];
            foreach($settings as $key=>$value){
                DB::table('platform_settings')->insert([
                    'key'=>$key,'value'=>json_encode($value,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),
                    'created_at'=>now(),'updated_at'=>now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_settings');
        Schema::dropIfExists('course_categories');
        if (Schema::hasColumn('users','status')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropIndex(['status']);
                $table->dropColumn('status');
            });
        }
    }
};
