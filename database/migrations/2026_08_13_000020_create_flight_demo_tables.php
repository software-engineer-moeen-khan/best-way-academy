<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flight_demo_players', function (Blueprint $table) {
            $table->id();
            $table->string('player_key', 80)->unique();
            $table->decimal('balance', 12, 2)->default(10000);
            $table->decimal('lifetime_bet', 14, 2)->default(0);
            $table->decimal('lifetime_won', 14, 2)->default(0);
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('flight_demo_rounds', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->string('status', 20)->default('betting')->index();
            $table->decimal('crash_multiplier', 8, 2);
            $table->timestamp('betting_ends_at', 3)->index();
            $table->timestamp('started_at', 3)->index();
            $table->timestamp('scheduled_crash_at', 3)->index();
            $table->timestamp('settled_at', 3)->nullable();
            $table->timestamps();
        });

        Schema::create('flight_demo_bets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('flight_demo_players')->cascadeOnDelete();
            $table->foreignId('round_id')->constrained('flight_demo_rounds')->cascadeOnDelete();
            $table->unsignedTinyInteger('slot');
            $table->decimal('amount', 12, 2);
            $table->decimal('auto_cashout', 8, 2)->nullable();
            $table->string('status', 20)->default('queued')->index();
            $table->decimal('cashout_multiplier', 8, 2)->nullable();
            $table->decimal('payout', 12, 2)->nullable();
            $table->timestamp('placed_at', 3);
            $table->timestamp('cashed_out_at', 3)->nullable();
            $table->timestamps();

            $table->unique(['round_id', 'player_id', 'slot'], 'flight_demo_round_player_slot_unique');
            $table->index(['round_id', 'status']);
            $table->index(['player_id', 'created_at']);
        });

        Schema::create('flight_demo_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('flight_demo_players')->cascadeOnDelete();
            $table->foreignId('bet_id')->nullable()->constrained('flight_demo_bets')->nullOnDelete();
            $table->string('type', 24)->index();
            $table->decimal('amount', 12, 2);
            $table->decimal('balance_after', 12, 2);
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flight_demo_transactions');
        Schema::dropIfExists('flight_demo_bets');
        Schema::dropIfExists('flight_demo_rounds');
        Schema::dropIfExists('flight_demo_players');
    }
};
