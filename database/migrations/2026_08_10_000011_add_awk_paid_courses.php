<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $adminId=DB::table('users')->where('role','admin')->orderBy('id')->value('id');

        if(Schema::hasTable('course_categories')){
            DB::table('course_categories')->updateOrInsert(
                ['name'=>'Trading'],
                [
                    'slug'=>'trading',
                    'description'=>'AWK paid Forex and trading courses from beginner to complete strategy systems.',
                    'icon'=>'📈',
                    'active'=>true,
                    'position'=>1,
                    'updated_at'=>now(),
                    'created_at'=>now(),
                ]
            );
        }

        if(Schema::hasTable('platform_settings')){
            DB::table('platform_settings')->updateOrInsert(
                ['key'=>'site_name'],
                ['value'=>json_encode('AWK Paid Courses'),'updated_at'=>now(),'created_at'=>now()]
            );
        }

        $courses=[
            'beginner-trading'=>[
                'title'=>'Beginner Trading Course',
                'subtitle'=>'Build strong Forex foundations from market basics to placing your first disciplined trade.',
                'description'=>'A step-by-step beginner course covering Forex basics, market behavior, chart reading, candlesticks, support and resistance, timeframes, terminology and basic risk management.',
                'price'=>1500,
                'badge'=>'Azadi Sale',
                'image'=>'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=85',
                'learn'=>['What is Forex?','How the market works','Which pair is best for beginners?','Forex basics','Support & resistance','Candlesticks','Candle stick patterns','Basic chart reading','Timeframes explanation','Trading terminology','Basic risk management','How to place a trade?'],
            ],
            'advanced-trading'=>[
                'title'=>'Advanced Trading Course',
                'subtitle'=>'Move beyond the basics into market structure, liquidity, SMC concepts and advanced risk management.',
                'description'=>'An advanced Forex course covering market structure, liquidity, Fibonacci, order blocks, fair value gaps, Smart Money Concepts, BOS, CHoCH, imbalance, psychology and backtesting.',
                'price'=>3000,
                'badge'=>'Azadi Sale',
                'image'=>'https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=1200&q=85',
                'learn'=>['All beginner course topics','Market structure','Liquidity concepts','Fibonacci retracement levels','Order blocks','Fair Value Gaps (FVG)','Smart Money Concepts','Break of Structure (BOS)','Change of Character (CHoCH)','Imbalance','Advanced risk management','Backtesting guide','Trading psychology','Two tested high-winrate strategies'],
            ],
            'strategy-trading'=>[
                'title'=>'Trading Strategy Course',
                'subtitle'=>'Learn five structured trading strategies with clear entry, exit and risk rules.',
                'description'=>'A focused strategy course covering five high-winrate strategies, entry and exit rules, stop loss placement, risk-to-reward, best trading times, backtesting and performance review.',
                'price'=>4000,
                'badge'=>'Strategy Pack',
                'image'=>'https://images.unsplash.com/photo-1535320903710-d993d3d77d29?auto=format&fit=crop&w=1200&q=85',
                'learn'=>['5 high-winrate strategies','Entry rules','Exit rules','Stop loss placement','Risk-to-reward ratio','Best time to trade','Strategy backtesting','Live examples','Common mistakes','Performance tips'],
            ],
            'all-in-one-trading'=>[
                'title'=>'All-in-One Trading Course',
                'subtitle'=>'The complete AWK trading package: beginner, advanced and strategy training in one course.',
                'description'=>'The complete AWK course package with beginner and advanced concepts, all five strategies, live market examples, backtesting, trading psychology, money management, lifetime updates and personal support.',
                'price'=>5000,
                'badge'=>'Best Value',
                'image'=>'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=85',
                'learn'=>['All beginner topics','All advanced topics','All 5 strategies','Live market examples','Backtesting & optimization','Trading psychology','Risk management','Money management','Complete trading system','Lifetime updates','Personal support'],
            ],
        ];

        foreach($courses as $slug=>$course){
            $metadata=json_encode([
                'learn'=>$course['learn'],
                'modules'=>$course['learn'],
                'old_price'=>match($slug){
                    'beginner-trading'=>2500,
                    'advanced-trading'=>5000,
                    'strategy-trading'=>6000,
                    default=>8000,
                },
                'sale'=>'Azadi Sale',
            ],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);

            $existing=DB::table('courses')->where('slug',$slug)->first();
            $values=[
                'instructor_id'=>$adminId,
                'title'=>$course['title'],
                'category'=>'Trading',
                'subtitle'=>$course['subtitle'],
                'description'=>$course['description'],
                'price'=>$course['price'],
                'status'=>'published',
                'image'=>$course['image'],
                'badge'=>$course['badge'],
                'metadata'=>$metadata,
                'updated_at'=>now(),
            ];

            if($existing){
                DB::table('courses')->where('id',$existing->id)->update($values);
            }else{
                DB::table('courses')->insert([
                    'slug'=>$slug,
                    'rating'=>4.9,
                    'students_count'=>0,
                    'created_at'=>now(),
                    ...$values,
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('courses')->whereIn('slug',[
            'beginner-trading','advanced-trading','strategy-trading','all-in-one-trading',
        ])->delete();

        if(Schema::hasTable('course_categories')){
            DB::table('course_categories')->where('name','Trading')->delete();
        }
    }
};
