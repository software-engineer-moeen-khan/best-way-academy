<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $adminEmail=strtolower((string) env('ADMIN_EMAIL','admin@example.com'));
        $admin=User::firstOrNew(['email'=>$adminEmail]);
        $admin->name=(string) env('ADMIN_NAME','Best Way Academy Admin');
        $admin->role='admin';
        if(!$admin->exists){
            $admin->password=Hash::make((string) env('ADMIN_PASSWORD','ChangeMe123!'));
        }
        $admin->save();

        $courses = [
            'python'=>['Python & Web Development Bootcamp','Development','Go from Python fundamentals to modern web development with practical projects you can add to your portfolio.',4999,4.8,2431,'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=85','Bestseller',['Python foundations and problem solving','HTML, CSS and JavaScript essentials','Frontend projects and responsive design','APIs, deployment and final project'],['Write clean Python programs from scratch','Build responsive web interfaces','Work with APIs and real project data','Create portfolio-ready applications']],
            'ai'=>['Complete AI, ChatGPT & Prompt Engineering','Artificial Intelligence','Use modern generative AI tools confidently for research, productivity, content and practical automation.',5499,4.9,1903,'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=85','Hot & New',['Generative AI fundamentals','Prompt engineering frameworks','ChatGPT workflows and productivity','Automation projects and responsible AI'],['Understand practical generative AI concepts','Write reliable prompts for real tasks','Create repeatable AI workflows','Use AI responsibly in professional work']],
            'data'=>['Data Science & Analytics Career Track','Data','Build job-ready analytics skills with Python, data cleaning, visualization and practical business projects.',6999,4.7,1154,'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85','Career Track',['Data analysis foundations','Python and pandas','Visualization and dashboards','Capstone analytics project'],['Clean and analyze real datasets','Build clear dashboards and reports','Use Python for data analysis','Present insights for business decisions']],
            'marketing'=>['Digital Marketing, SEO & Social Media','Marketing','Learn practical digital marketing strategies for SEO, social media, content and paid campaigns.',3999,4.8,973,'https://images.unsplash.com/photo-1557838923-2985c318be48?auto=format&fit=crop&w=1200&q=85','Popular',['Digital marketing strategy','SEO and content marketing','Social media and paid campaigns','Analytics and campaign optimization'],['Plan an effective digital strategy','Improve website SEO fundamentals','Build social media campaigns','Measure performance and conversions']],
            'excel'=>['Microsoft Excel for Business & Analytics','Data','Master formulas, reporting, charts and practical Excel workflows for everyday business analysis.',2999,4.8,821,'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=85','Popular',['Excel essentials','Formulas and functions','Pivot tables and dashboards','Business reporting project'],['Use essential and advanced formulas','Clean and organize business data','Create charts and dashboards','Automate common reporting workflows']],
            'cloud'=>['Cloud Engineer Career Path','Career','Build foundations in cloud infrastructure, AWS concepts, Linux and networking for a cloud career.',6499,4.7,667,'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=85','Career Track',['Cloud computing foundations','Linux essentials','Networking for cloud','AWS services and career project'],['Understand cloud infrastructure','Work with core AWS concepts','Use Linux for cloud environments','Apply networking fundamentals']],
        ];

        foreach ($courses as $slug=>$c) {
            // Seed only missing catalog records. Existing production edits must survive future deploys.
            $course=Course::firstOrCreate(['slug'=>$slug],[
                'instructor_id'=>$admin->id,'title'=>$c[0],'category'=>$c[1],'subtitle'=>$c[2],'description'=>$c[2],
                'price'=>$c[3],'status'=>'published','rating'=>$c[4],'students_count'=>$c[5],'image'=>$c[6],'badge'=>$c[7],
                'metadata'=>['modules'=>$c[8],'learn'=>$c[9]],
            ]);
            if ($course->sections()->count()===0) {
                foreach ($c[8] as $si=>$module) {
                    $section=$course->sections()->create(['title'=>$module,'position'=>$si+1]);
                    foreach (['Overview','Guided Practice','Practice & Review'] as $li=>$suffix) {
                        $section->lessons()->create(['title'=>$module.': '.$suffix,'position'=>$li+1,'is_preview'=>$si===0 && $li===0]);
                    }
                }
            }
        }

        // Keep the welcome coupon server-side so checkout totals cannot be changed only in the browser.
        DB::table('coupons')->updateOrInsert(
            ['code'=>'WELCOME20'],
            ['course_id'=>null,'discount_type'=>'percent','discount_value'=>20,'active'=>true,'updated_at'=>now()]
        );
    }
}
