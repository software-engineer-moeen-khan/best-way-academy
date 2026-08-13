<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FlightLabController extends Controller
{
    private const STARTING_BALANCE = 10000.00;
    private const MIN_BET = 10.00;
    private const MAX_BET = 5000.00;
    private const BETTING_SECONDS = 6;
    private const COOLDOWN_SECONDS = 2;
    private const GROWTH_RATE = 0.075;
    private const MAX_MULTIPLIER = 100.00;

    public function state(Request $request): JsonResponse
    {
        $player = $this->player($request);
        $round = $this->syncRound();
        $now = now();
        $phase = $this->phase($round, $now);
        $current = $this->currentMultiplier($round, $now);

        $player = DB::table('flight_demo_players')->where('id', $player->id)->first();
        $bets = DB::table('flight_demo_bets')
            ->where('round_id', $round->id)
            ->where('player_id', $player->id)
            ->orderBy('slot')
            ->get()
            ->map(fn ($bet) => $this->betPayload($bet));

        $history = DB::table('flight_demo_rounds')
            ->where('scheduled_crash_at', '<=', $now)
            ->orderByDesc('id')
            ->limit(12)
            ->get(['public_id', 'crash_multiplier', 'scheduled_crash_at'])
            ->map(fn ($item) => [
                'round_id' => $item->public_id,
                'multiplier' => (float) $item->crash_multiplier,
                'ended_at' => $item->scheduled_crash_at,
            ]);

        $activity = DB::table('flight_demo_bets as b')
            ->join('flight_demo_players as p', 'p.id', '=', 'b.player_id')
            ->join('flight_demo_rounds as r', 'r.id', '=', 'b.round_id')
            ->whereIn('b.status', ['cashed_out', 'lost'])
            ->orderByDesc('b.updated_at')
            ->limit(14)
            ->get([
                'p.player_key', 'b.amount', 'b.status', 'b.cashout_multiplier',
                'b.payout', 'r.crash_multiplier', 'b.updated_at',
            ])
            ->map(function ($item) {
                return [
                    'player' => $this->maskPlayerKey($item->player_key),
                    'amount' => (float) $item->amount,
                    'status' => $item->status,
                    'multiplier' => $item->status === 'cashed_out'
                        ? (float) $item->cashout_multiplier
                        : (float) $item->crash_multiplier,
                    'payout' => $item->payout === null ? null : (float) $item->payout,
                    'updated_at' => $item->updated_at,
                ];
            });

        $elapsed = $phase === 'flying'
            ? max(0, $this->asCarbon($round->started_at)->diffInMilliseconds($now, false) / 1000)
            : ($phase === 'crashed' ? $this->secondsForMultiplier((float) $round->crash_multiplier) : 0);

        return response()->json([
            'mode' => 'demo',
            'currency' => 'DEMO',
            'limits' => ['min_bet' => self::MIN_BET, 'max_bet' => self::MAX_BET],
            'player' => [
                'balance' => (float) $player->balance,
                'lifetime_bet' => (float) $player->lifetime_bet,
                'lifetime_won' => (float) $player->lifetime_won,
            ],
            'round' => [
                'id' => $round->public_id,
                'phase' => $phase,
                'current_multiplier' => $current,
                'crash_multiplier' => $phase === 'crashed' ? (float) $round->crash_multiplier : null,
                'seconds_to_start' => $phase === 'betting'
                    ? max(0, $now->diffInMilliseconds($this->asCarbon($round->started_at), false) / 1000)
                    : 0,
                'elapsed_seconds' => round($elapsed, 3),
                'growth_rate' => self::GROWTH_RATE,
            ],
            'bets' => $bets,
            'history' => $history,
            'activity' => $activity,
            'server_time_ms' => (int) floor(microtime(true) * 1000),
        ]);
    }

    public function placeBet(Request $request): JsonResponse
    {
        $data = $request->validate([
            'slot' => ['required', 'integer', 'between:1,2'],
            'amount' => ['required', 'numeric', 'min:'.self::MIN_BET, 'max:'.self::MAX_BET],
            'auto_cashout' => ['nullable', 'numeric', 'min:1.10', 'max:'.self::MAX_MULTIPLIER],
        ]);

        $player = $this->player($request);
        $round = $this->syncRound();

        $bet = DB::transaction(function () use ($data, $player, $round) {
            $lockedRound = DB::table('flight_demo_rounds')->where('id', $round->id)->lockForUpdate()->first();
            if ($this->phase($lockedRound, now()) !== 'betting') {
                throw ValidationException::withMessages(['round' => 'Betting is closed for this round.']);
            }

            $lockedPlayer = DB::table('flight_demo_players')->where('id', $player->id)->lockForUpdate()->first();
            $amount = round((float) $data['amount'], 2);
            if ((float) $lockedPlayer->balance < $amount) {
                throw ValidationException::withMessages(['amount' => 'Not enough demo credits.']);
            }

            $existing = DB::table('flight_demo_bets')
                ->where('round_id', $lockedRound->id)
                ->where('player_id', $lockedPlayer->id)
                ->where('slot', (int) $data['slot'])
                ->first();
            if ($existing) {
                throw ValidationException::withMessages(['slot' => 'This bet slot is already used for the current round.']);
            }

            $newBalance = round((float) $lockedPlayer->balance - $amount, 2);
            DB::table('flight_demo_players')->where('id', $lockedPlayer->id)->update([
                'balance' => $newBalance,
                'lifetime_bet' => DB::raw('lifetime_bet + '.number_format($amount, 2, '.', '')),
                'last_seen_at' => now(),
                'updated_at' => now(),
            ]);

            $betId = DB::table('flight_demo_bets')->insertGetId([
                'player_id' => $lockedPlayer->id,
                'round_id' => $lockedRound->id,
                'slot' => (int) $data['slot'],
                'amount' => $amount,
                'auto_cashout' => isset($data['auto_cashout']) ? round((float) $data['auto_cashout'], 2) : null,
                'status' => 'queued',
                'placed_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->recordTransaction($lockedPlayer->id, $betId, 'bet', -$amount, $newBalance, [
                'round_id' => $lockedRound->public_id,
                'slot' => (int) $data['slot'],
            ]);

            return DB::table('flight_demo_bets')->where('id', $betId)->first();
        });

        return response()->json(['ok' => true, 'bet' => $this->betPayload($bet)], 201);
    }

    public function cancelBet(Request $request, int $slot): JsonResponse
    {
        if ($slot < 1 || $slot > 2) {
            throw ValidationException::withMessages(['slot' => 'Invalid bet slot.']);
        }

        $player = $this->player($request);
        $round = $this->syncRound();

        DB::transaction(function () use ($slot, $player, $round) {
            $lockedRound = DB::table('flight_demo_rounds')->where('id', $round->id)->lockForUpdate()->first();
            if ($this->phase($lockedRound, now()) !== 'betting') {
                throw ValidationException::withMessages(['round' => 'This bet can no longer be cancelled.']);
            }

            $bet = DB::table('flight_demo_bets')
                ->where('round_id', $lockedRound->id)
                ->where('player_id', $player->id)
                ->where('slot', $slot)
                ->lockForUpdate()
                ->first();
            if (! $bet || $bet->status !== 'queued') {
                throw ValidationException::withMessages(['bet' => 'No cancellable bet found in this slot.']);
            }

            $lockedPlayer = DB::table('flight_demo_players')->where('id', $player->id)->lockForUpdate()->first();
            $refund = (float) $bet->amount;
            $newBalance = round((float) $lockedPlayer->balance + $refund, 2);

            DB::table('flight_demo_players')->where('id', $lockedPlayer->id)->update([
                'balance' => $newBalance,
                'last_seen_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('flight_demo_bets')->where('id', $bet->id)->update([
                'status' => 'cancelled',
                'updated_at' => now(),
            ]);
            $this->recordTransaction($lockedPlayer->id, $bet->id, 'refund', $refund, $newBalance, [
                'round_id' => $lockedRound->public_id,
                'slot' => $slot,
            ]);
        });

        return response()->json(['ok' => true]);
    }

    public function cashout(Request $request): JsonResponse
    {
        $data = $request->validate(['slot' => ['required', 'integer', 'between:1,2']]);
        $player = $this->player($request);
        $round = $this->syncRound();

        $result = DB::transaction(function () use ($data, $player, $round) {
            $lockedRound = DB::table('flight_demo_rounds')->where('id', $round->id)->lockForUpdate()->first();
            $now = now();
            if ($this->phase($lockedRound, $now) !== 'flying') {
                throw ValidationException::withMessages(['round' => 'Cash out is only available while the plane is flying.']);
            }

            $bet = DB::table('flight_demo_bets')
                ->where('round_id', $lockedRound->id)
                ->where('player_id', $player->id)
                ->where('slot', (int) $data['slot'])
                ->lockForUpdate()
                ->first();
            if (! $bet || ! in_array($bet->status, ['queued', 'active'], true)) {
                throw ValidationException::withMessages(['bet' => 'No active bet found in this slot.']);
            }

            $multiplier = $this->currentMultiplier($lockedRound, $now);
            $payout = round((float) $bet->amount * $multiplier, 2);
            $lockedPlayer = DB::table('flight_demo_players')->where('id', $player->id)->lockForUpdate()->first();
            $newBalance = round((float) $lockedPlayer->balance + $payout, 2);

            DB::table('flight_demo_players')->where('id', $lockedPlayer->id)->update([
                'balance' => $newBalance,
                'lifetime_won' => DB::raw('lifetime_won + '.number_format($payout, 2, '.', '')),
                'last_seen_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('flight_demo_bets')->where('id', $bet->id)->update([
                'status' => 'cashed_out',
                'cashout_multiplier' => $multiplier,
                'payout' => $payout,
                'cashed_out_at' => $now,
                'updated_at' => $now,
            ]);
            $this->recordTransaction($lockedPlayer->id, $bet->id, 'cashout', $payout, $newBalance, [
                'round_id' => $lockedRound->public_id,
                'slot' => (int) $data['slot'],
                'multiplier' => $multiplier,
            ]);

            return ['multiplier' => $multiplier, 'payout' => $payout, 'balance' => $newBalance];
        });

        return response()->json(['ok' => true] + $result);
    }

    public function reset(Request $request): JsonResponse
    {
        $player = $this->player($request);
        $this->syncRound();

        $balance = DB::transaction(function () use ($player) {
            $lockedPlayer = DB::table('flight_demo_players')->where('id', $player->id)->lockForUpdate()->first();
            $openBet = DB::table('flight_demo_bets')
                ->where('player_id', $lockedPlayer->id)
                ->whereIn('status', ['queued', 'active'])
                ->exists();
            if ($openBet) {
                throw ValidationException::withMessages(['balance' => 'Finish or cancel active demo bets before resetting.']);
            }

            $oldBalance = (float) $lockedPlayer->balance;
            $newBalance = self::STARTING_BALANCE;
            DB::table('flight_demo_players')->where('id', $lockedPlayer->id)->update([
                'balance' => $newBalance,
                'last_seen_at' => now(),
                'updated_at' => now(),
            ]);
            $this->recordTransaction($lockedPlayer->id, null, 'reset', round($newBalance - $oldBalance, 2), $newBalance);

            return $newBalance;
        });

        return response()->json(['ok' => true, 'balance' => $balance]);
    }

    private function player(Request $request): object
    {
        $key = trim((string) $request->header('X-Flight-Player', ''));
        if (! preg_match('/^[A-Za-z0-9_-]{20,80}$/', $key)) {
            throw ValidationException::withMessages(['player' => 'A valid demo player key is required.']);
        }

        DB::table('flight_demo_players')->insertOrIgnore([
            'player_key' => $key,
            'balance' => self::STARTING_BALANCE,
            'lifetime_bet' => 0,
            'lifetime_won' => 0,
            'last_seen_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return DB::table('flight_demo_players')->where('player_key', $key)->first();
    }

    private function syncRound(): object
    {
        return DB::transaction(function () {
            $now = now();
            $round = DB::table('flight_demo_rounds')->orderByDesc('id')->lockForUpdate()->first();

            if ($round) {
                $this->settleRoundBets($round, $now);
                $phase = $this->phase($round, $now);
                if ($phase !== $round->status) {
                    DB::table('flight_demo_rounds')->where('id', $round->id)->update([
                        'status' => $phase,
                        'settled_at' => $phase === 'crashed' ? $now : $round->settled_at,
                        'updated_at' => $now,
                    ]);
                    $round = DB::table('flight_demo_rounds')->where('id', $round->id)->first();
                }
            }

            if (! $round || $now->greaterThanOrEqualTo($this->asCarbon($round->scheduled_crash_at)->addSeconds(self::COOLDOWN_SECONDS))) {
                $bettingEnds = $now->copy()->addSeconds(self::BETTING_SECONDS);
                $crashMultiplier = $this->generateCrashMultiplier();
                $crashAt = $bettingEnds->copy()->addMilliseconds((int) round($this->secondsForMultiplier($crashMultiplier) * 1000));

                $roundId = DB::table('flight_demo_rounds')->insertGetId([
                    'public_id' => (string) Str::uuid(),
                    'status' => 'betting',
                    'crash_multiplier' => $crashMultiplier,
                    'betting_ends_at' => $bettingEnds,
                    'started_at' => $bettingEnds,
                    'scheduled_crash_at' => $crashAt,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $round = DB::table('flight_demo_rounds')->where('id', $roundId)->first();
            }

            return $round;
        }, 3);
    }

    private function settleRoundBets(object $round, CarbonInterface $now): void
    {
        $phase = $this->phase($round, $now);
        if ($phase === 'betting') {
            return;
        }

        $current = $this->currentMultiplier($round, $now);
        $bets = DB::table('flight_demo_bets')
            ->where('round_id', $round->id)
            ->whereIn('status', ['queued', 'active'])
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($bets as $bet) {
            $auto = $bet->auto_cashout === null ? null : (float) $bet->auto_cashout;
            $shouldAutoCashout = $auto !== null && (
                ($phase === 'flying' && $current >= $auto) ||
                ($phase === 'crashed' && $auto <= (float) $round->crash_multiplier)
            );

            if ($shouldAutoCashout) {
                $payout = round((float) $bet->amount * $auto, 2);
                $player = DB::table('flight_demo_players')->where('id', $bet->player_id)->lockForUpdate()->first();
                $newBalance = round((float) $player->balance + $payout, 2);
                DB::table('flight_demo_players')->where('id', $player->id)->update([
                    'balance' => $newBalance,
                    'lifetime_won' => DB::raw('lifetime_won + '.number_format($payout, 2, '.', '')),
                    'updated_at' => $now,
                ]);
                DB::table('flight_demo_bets')->where('id', $bet->id)->update([
                    'status' => 'cashed_out',
                    'cashout_multiplier' => $auto,
                    'payout' => $payout,
                    'cashed_out_at' => $now,
                    'updated_at' => $now,
                ]);
                $this->recordTransaction($player->id, $bet->id, 'auto_cashout', $payout, $newBalance, [
                    'round_id' => $round->public_id,
                    'slot' => (int) $bet->slot,
                    'multiplier' => $auto,
                ]);
                continue;
            }

            if ($phase === 'flying' && $bet->status === 'queued') {
                DB::table('flight_demo_bets')->where('id', $bet->id)->update(['status' => 'active', 'updated_at' => $now]);
            } elseif ($phase === 'crashed') {
                DB::table('flight_demo_bets')->where('id', $bet->id)->update(['status' => 'lost', 'updated_at' => $now]);
            }
        }
    }

    private function phase(object $round, CarbonInterface $now): string
    {
        if ($now->lt($this->asCarbon($round->started_at))) {
            return 'betting';
        }
        if ($now->lt($this->asCarbon($round->scheduled_crash_at))) {
            return 'flying';
        }
        return 'crashed';
    }

    private function currentMultiplier(object $round, CarbonInterface $now): float
    {
        $phase = $this->phase($round, $now);
        if ($phase === 'betting') {
            return 1.00;
        }
        if ($phase === 'crashed') {
            return (float) $round->crash_multiplier;
        }

        $elapsed = max(0, $this->asCarbon($round->started_at)->diffInMilliseconds($now, false) / 1000);
        return round(min(self::MAX_MULTIPLIER, exp($elapsed * self::GROWTH_RATE)), 2);
    }

    private function secondsForMultiplier(float $multiplier): float
    {
        return log(max(1.0001, $multiplier)) / self::GROWTH_RATE;
    }

    private function generateCrashMultiplier(): float
    {
        $u = random_int(1, 999999) / 1000000;
        $value = pow(1 - $u, -0.62);
        return round(min(self::MAX_MULTIPLIER, max(1.01, $value)), 2);
    }

    private function asCarbon(string|CarbonInterface $value): CarbonInterface
    {
        return $value instanceof CarbonInterface ? $value->copy() : Carbon::parse($value);
    }

    private function betPayload(object $bet): array
    {
        return [
            'id' => (int) $bet->id,
            'slot' => (int) $bet->slot,
            'amount' => (float) $bet->amount,
            'auto_cashout' => $bet->auto_cashout === null ? null : (float) $bet->auto_cashout,
            'status' => $bet->status,
            'cashout_multiplier' => $bet->cashout_multiplier === null ? null : (float) $bet->cashout_multiplier,
            'payout' => $bet->payout === null ? null : (float) $bet->payout,
        ];
    }

    private function recordTransaction(int $playerId, ?int $betId, string $type, float $amount, float $balanceAfter, array $meta = []): void
    {
        DB::table('flight_demo_transactions')->insert([
            'player_id' => $playerId,
            'bet_id' => $betId,
            'type' => $type,
            'amount' => round($amount, 2),
            'balance_after' => round($balanceAfter, 2),
            'meta' => $meta ? json_encode($meta, JSON_THROW_ON_ERROR) : null,
            'created_at' => now(),
        ]);
    }

    private function maskPlayerKey(string $key): string
    {
        return 'de***'.strtolower(substr($key, -3));
    }
}
