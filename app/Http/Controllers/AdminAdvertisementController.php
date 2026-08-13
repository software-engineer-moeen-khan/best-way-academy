<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminAdvertisementController extends Controller
{
    private const GOOGLE_AI_POPUNDER = 'homepage_google_ai_popunder';
    private const POPULAR_SKILLS_LONGBAR = 'homepage_popular_skills_longbar';
    private const COURSE_DETAIL_HERO = 'course_detail_hero_ad';
    private const COURSE_DETAIL_CONTENT = 'course_detail_before_learn_ad';

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

        return [
            'ad_type' => 'image',
            'image_url' => $this->cleanLink($data['image_url'] ?? null, true),
            'embed_code' => null,
            'target_url' => $this->cleanLink($data['target_url'] ?? null),
            'alt_text' => trim((string) ($data['alt_text'] ?? '')) ?: null,
        ];
    }

    private function payload(object $row, array $placements = []): array
    {
        return [
            'id' => (int) $row->id,
            'name' => $row->name,
            'ad_type' => $row->ad_type ?? 'image',
            'image_url' => $row->image_url,
            'embed_code' => $row->embed_code ?? null,
            'target_url' => $row->target_url,
            'alt_text' => $row->alt_text,
            'placement_key' => $placements[0] ?? $row->placement_key ?? null,
            'placements' => array_values($placements),
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

    private function placementAdvertisement(string $placementKey): ?object
    {
        return DB::table('advertisement_placements as ap')
            ->join('advertisements as a', 'a.id', '=', 'ap.advertisement_id')
            ->where('ap.placement_key', $placementKey)
            ->where('a.active', true)
            ->select('a.*')
            ->first();
    }

    private function assignPlacement(Request $request, string $placementKey, string $mode): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate([
            'advertisement_id' => ['nullable', 'integer'],
        ]);
        $advertisementId = isset($data['advertisement_id']) ? (int) $data['advertisement_id'] : null;

        DB::transaction(function () use ($advertisementId, $placementKey, $mode): void {
            if (!$advertisementId) {
                DB::table('advertisement_placements')->where('placement_key', $placementKey)->delete();
                return;
            }

            $row = DB::table('advertisements')->where('id', $advertisementId)->first();
            abort_unless($row, 404, 'Advertisement not found.');
            abort_unless((bool) $row->active, 422, 'Choose an active advertisement.');

            $type = ($row->ad_type ?? 'image') === 'embed' ? 'embed' : 'image';
            if ($type === 'embed') {
                abort_if(trim((string) ($row->embed_code ?? '')) === '', 422, 'This Embed Code advertisement has no embed code.');
            } elseif ($mode === 'popunder') {
                abort_if(trim((string) ($row->target_url ?? '')) === '', 422, 'An Image advertisement needs a destination URL before it can be used as a popunder.');
            } else {
                abort_if(trim((string) ($row->image_url ?? '')) === '', 422, 'This Image advertisement has no image URL.');
            }

            $exists = DB::table('advertisement_placements')->where('placement_key', $placementKey)->exists();
            if ($exists) {
                DB::table('advertisement_placements')->where('placement_key', $placementKey)->update([
                    'advertisement_id' => $advertisementId,
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('advertisement_placements')->insert([
                    'placement_key' => $placementKey,
                    'advertisement_id' => $advertisementId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        return response()->json([
            'ok' => true,
            'placement_key' => $placementKey,
            'advertisement_id' => $advertisementId,
        ]);
    }

    public function publicGoogleAiPopunder(): JsonResponse
    {
        $row = $this->placementAdvertisement(self::GOOGLE_AI_POPUNDER);

        return response()->json([
            'advertisement' => $row ? $this->payload($row, [self::GOOGLE_AI_POPUNDER]) : null,
        ])->header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    public function publicCourseDetailHero(Request $request): JsonResponse
    {
        $placement = $request->query('placement') === 'content'
            ? self::COURSE_DETAIL_CONTENT
            : self::COURSE_DETAIL_HERO;
        $row = $this->placementAdvertisement($placement);

        return response()->json([
            'advertisement' => $row ? $this->payload($row, [$placement]) : null,
        ])->header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    public function assignGoogleAiPopunder(Request $request): JsonResponse
    {
        return $this->assignPlacement($request, self::GOOGLE_AI_POPUNDER, 'popunder');
    }

    public function assignPopularSkillsLongbar(Request $request): JsonResponse
    {
        return $this->assignPlacement($request, self::POPULAR_SKILLS_LONGBAR, 'longbar');
    }

    public function assignCourseDetailHero(Request $request): JsonResponse
    {
        $placement = $request->query('placement') === 'content'
            ? self::COURSE_DETAIL_CONTENT
            : self::COURSE_DETAIL_HERO;

        return $this->assignPlacement($request, $placement, 'display');
    }

    public function index(Request $request): JsonResponse
    {
        $this->admin($request);

        $placementsByAdvertisement = DB::table('advertisement_placements')
            ->orderBy('placement_key')
            ->get(['advertisement_id', 'placement_key'])
            ->groupBy(fn ($row) => (int) $row->advertisement_id)
            ->map(fn ($rows) => $rows->pluck('placement_key')->values()->all());

        $items = DB::table('advertisements')
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($row) => $this->payload($row, $placementsByAdvertisement->get((int) $row->id, [])))
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
        $placements = DB::table('advertisement_placements')
            ->where('advertisement_id', $advertisement)
            ->orderBy('placement_key')
            ->pluck('placement_key')
            ->all();

        return response()->json(['ok' => true, 'advertisement' => $this->payload($row, $placements)]);
    }

    public function destroy(Request $request, int $advertisement): JsonResponse
    {
        $this->admin($request);
        $deleted = DB::table('advertisements')->where('id', $advertisement)->delete();
        abort_unless($deleted, 404);

        return response()->json(['ok' => true]);
    }
}
