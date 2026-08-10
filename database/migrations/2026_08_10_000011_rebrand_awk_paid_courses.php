<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('platform_settings')) {
            DB::table('platform_settings')->updateOrInsert(
                ['key' => 'site_name'],
                ['value' => json_encode('AWK Paid Courses'), 'created_at' => now(), 'updated_at' => now()]
            );
            DB::table('platform_settings')->updateOrInsert(
                ['key' => 'sadapay_account_number'],
                ['value' => json_encode(''), 'created_at' => now(), 'updated_at' => now()]
            );
        }

        if (Schema::hasTable('coupons')) {
            DB::table('coupons')->updateOrInsert(
                ['code' => 'AZADI3000'],
                [
                    'course_id' => null,
                    'discount_type' => 'fixed',
                    'discount_value' => 3000,
                    'starts_at' => null,
                    'ends_at' => null,
                    'max_uses' => null,
                    'active' => true,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('platform_settings')) {
            DB::table('platform_settings')->where('key', 'sadapay_account_number')->delete();
            DB::table('platform_settings')->where('key', 'site_name')->where('value', json_encode('AWK Paid Courses'))->update([
                'value' => json_encode('Best Way Academy'),
                'updated_at' => now(),
            ]);
        }

        if (Schema::hasTable('coupons')) {
            DB::table('coupons')->where('code', 'AZADI3000')->where('uses', 0)->delete();
        }
    }
};
