<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PromoMessageController extends Controller
{
    public const DEFAULT_MESSAGE = 'Save 30% on yearly learning plans — learn more, spend less.';

    private function admin(Request $request): User
    {
        $user = $request->user();
        abort_unless($user?->role === 'admin', 403);

        return $user;
    }

    private function storedMessage(): string
    {
        $value = DB::table('platform_settings')->where('key', 'promo_message')->value('value');

        if ($value === null) {
            return self::DEFAULT_MESSAGE;
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return is_string($decoded) ? $decoded : (string) $decoded;
            }
        }

        return (string) $value;
    }

    public function show(Request $request): JsonResponse
    {
        $this->admin($request);

        return response()->json([
            'message' => $this->storedMessage(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->admin($request);

        $data = $request->validate([
            'message' => ['nullable', 'string', 'max:300'],
        ]);

        $message = trim((string) ($data['message'] ?? ''));
        $now = now();

        $exists = DB::table('platform_settings')->where('key', 'promo_message')->exists();
        if ($exists) {
            DB::table('platform_settings')->where('key', 'promo_message')->update([
                'value' => json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'updated_at' => $now,
            ]);
        } else {
            DB::table('platform_settings')->insert([
                'key' => 'promo_message',
                'value' => json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        return response()->json([
            'ok' => true,
            'message' => $message,
        ]);
    }
}
