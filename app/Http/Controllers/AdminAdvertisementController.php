<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminAdvertisementController extends Controller
{
    private const GOOGLE_AI_POPUNDER = 'homepage_google_ai_popunder';

    private function admin(Request $request): User
    {
        $user = $request->user();
        abort_unless($user?->role === 'admin', 403);

        return $user;
    }

    private function cleanLink(?string $value, bool $required = false): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            abort_if($required, 422, 'A URL is required.');
            return null;
        }

        abort_if(strlen($value) > 2048 || preg_match('/[\x00-\x1F\x7F]/', $value), 422, 'Invalid URL.');
        abort_if(preg_match('/^(?:javascript|data|vbscript|file|about):/i', $value), 422, 'Unsafe URL scheme is not allowed.');

        if (str_starts_with($value, '/') || str_starts_with($value, '#') || str_starts_with($value, '?')) {
            return $value;
        }

        if (preg_match('/^[a-z][a-z0-9+.-]*:/i', $value)) {
            return $value;
        }

        if (preg_match('/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:[\/\?#].*)?$/i', $value)) {
            return 'https://'.preg_replace('/^https?:\/\//i', '', $value);
        }

        abort(422, 'Enter a valid URL or internal path.');
    }

    private function normalizedCreative(array $data): array
    {
        $type = $data['ad_type'];

        if ($type === 'embed') {
            $embed = trim((string) ($data['embed_code'] ?? ''));
            abort_if($embed === '', 422, 'Embed code is required for an Embed Code advertisement.');

            return [
                'ad_type' => 'embed',
                'image_url' => null,
                'embed_code' => $embed,
                'target_url' => null,
                'alt_text' => null,
            ];
        }

        $imageUrl = $this->cleanLink($data['image_url'] ?? null, true);

        return [
            'ad_type' => 'image',
            'image_url' => $imageUrl,
            'embed_code' => null,
            'target_url' => $this->cleanLink($data['target_url'] ?? null),
            'alt_text' => trim((string) ($data['alt_text'] ?? '')) ?: null,
        ];
    }

    private function payload(object $row): array
    {
        return [
            'id' => (int) $row->id,
            'name' => $row->name,
            'ad_type' => $row->ad_type ?? 'image',
            'image_url' => $row->image_url,
            'embed_code' => $row->embed_code ?? null,
            'target_url' => $row->target_url,
            'alt_text' => $row->alt_text,
            'placement_key' => $row->placement_key,
            'active' => (bool) $row->active,
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
        ];
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'ad_type' => ['required', 'string', 'in:image,embed'],
            'image_url' => ['nullable', 'string', 'max:2048'],
            'embed_code' => ['nullable', 'string', 'max:200000'],
            'target_url' => ['nullable', 'string', 'max:2048'],
            'alt_text' => ['nullable', 'string', 'max:255'],
            'active' => ['required', 'boolean'],
        ]);
    }

    public function publicGoogleAiPopunder(): JsonResponse
    {
        $row = DB::table('advertisements')
            ->where('placement_key', self::GOOGLE_AI_POPUNDER)
            ->where('active', true)
            ->first();

        return response()->json([
            'advertisement' => $row ? $this->payload($row) : null,
        ])->header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    public function assignGoogleAiPopunder(Request $request): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate([
            'advertisement_id' => ['nullable', 'integer'],
        ]);
        $advertisementId = isset($data['advertisement_id']) ? (int) $data['advertisement_id'] : null;

        DB::transaction(function () use ($advertisementId): void {
            DB::table('advertisements')
                ->where('placement_key', self::GOOGLE_AI_POPUNDER)
                ->update(['placement_key' => null, 'updated_at' => now()]);

            if (!$advertisementId) {
                return;
            }

            $row = DB::table('advertisements')->where('id', $advertisementId)->first();
            abort_unless($row, 404, 'Advertisement not found.');
            abort_unless((bool) $row->active, 422, 'Choose an active advertisement.');

            $type = ($row->ad_type ?? 'image') === 'embed' ? 'embed' : 'image';
            if ($type === 'embed') {
                abort_if(trim((string) ($row->embed_code ?? '')) === '', 422, 'This Embed Code advertisement has no embed code.');
            } else {
                abort_if(trim((string) ($row->target_url ?? '')) === '', 422, 'An Image advertisement needs a destination URL before it can be used as a popunder.');
            }

            DB::table('advertisements')->where('id', $advertisementId)->update([
                'placement_key' => self::GOOGLE_AI_POPUNDER,
                'updated_at' => now(),
            ]);
        });

        return response()->json([
            'ok' => true,
            'placement_key' => self::GOOGLE_AI_POPUNDER,
            'advertisement_id' => $advertisementId,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->admin($request);

        $items = DB::table('advertisements')
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($row) => $this->payload($row))
            ->values();

        return response()->json(['advertisements' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->admin($request);
        $data = $this->validated($request);
        $creative = $this->normalizedCreative($data);
        $now = now();

        $id = DB::table('advertisements')->insertGetId([
            'name' => trim($data['name']),
            ...$creative,
            'placement_key' => null,
            'active' => (bool) $data['active'],
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $row = DB::table('advertisements')->where('id', $id)->first();

        return response()->json(['ok' => true, 'advertisement' => $this->payload($row)], 201);
    }

    public function update(Request $request, int $advertisement): JsonResponse
    {
        $this->admin($request);
        abort_unless(DB::table('advertisements')->where('id', $advertisement)->exists(), 404);

        $data = $this->validated($request);
        $creative = $this->normalizedCreative($data);

        DB::table('advertisements')->where('id', $advertisement)->update([
            'name' => trim($data['name']),
            ...$creative,
            'active' => (bool) $data['active'],
            'updated_at' => now(),
        ]);

        $row = DB::table('advertisements')->where('id', $advertisement)->first();

        return response()->json(['ok' => true, 'advertisement' => $this->payload($row)]);
    }

    public function destroy(Request $request, int $advertisement): JsonResponse
    {
        $this->admin($request);
        $deleted = DB::table('advertisements')->where('id', $advertisement)->delete();
        abort_unless($deleted, 404);

        return response()->json(['ok' => true]);
    }
}
