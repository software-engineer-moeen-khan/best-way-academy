<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('advertisement_placements', function (Blueprint $table) {
            $table->id();
            $table->string('placement_key', 120)->unique();
            $table->foreignId('advertisement_id')->constrained('advertisements')->cascadeOnDelete();
            $table->timestamps();
        });

        DB::table('advertisements')
            ->whereNotNull('placement_key')
            ->orderBy('id')
            ->get(['id', 'placement_key'])
            ->each(function ($row): void {
                $key = trim((string) $row->placement_key);
                if ($key === '') {
                    return;
                }

                DB::table('advertisement_placements')->insertOrIgnore([
                    'placement_key' => $key,
                    'advertisement_id' => (int) $row->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

        // The dedicated placement table is now the source of truth.
        DB::table('advertisements')->update(['placement_key' => null]);
    }

    public function down(): void
    {
        if (Schema::hasTable('advertisement_placements')) {
            DB::table('advertisement_placements')
                ->orderBy('id')
                ->get()
                ->each(function ($row): void {
                    DB::table('advertisements')
                        ->where('id', $row->advertisement_id)
                        ->whereNull('placement_key')
                        ->update(['placement_key' => $row->placement_key]);
                });
        }

        Schema::dropIfExists('advertisement_placements');
    }
};
