<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CertificationAdController extends Controller
{
    private const PLACEMENT = 'homepage_certifications_cta_ad';

    private function payload(object $row): array
    {
        return [
            'id' => (int) $row->id,
            'name' => (string) $row->name,
            'ad_type' => ($row->ad_type ?? 'image') === 'embed' ? 'embed' : 'image',
            'image_url' => $row->image_url ?? null,
            'embed_code' => $row->embed_code ?? null,
            'target_url' => $row->target_url ?? null,
            'alt_text' => $row->alt_text ?? null,
            'active' => (bool) $row->active,
        ];
    }

    public function show(): JsonResponse
    {
        $row = DB::table('advertisement_placements as ap')
            ->join('advertisements as a', 'a.id', '=', 'ap.advertisement_id')
            ->where('ap.placement_key', self::PLACEMENT)
            ->where('a.active', true)
            ->select('a.*')
            ->first();

        return response()->json([
            'advertisement' => $row ? $this->payload($row) : null,
        ])->header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    public function assign(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $data = $request->validate([
            'advertisement_id' => ['nullable', 'integer'],
        ]);
        $advertisementId = isset($data['advertisement_id']) ? (int) $data['advertisement_id'] : null;

        DB::transaction(function () use ($advertisementId): void {
            if (!$advertisementId) {
                DB::table('advertisement_placements')->where('placement_key', self::PLACEMENT)->delete();
                return;
            }

            $row = DB::table('advertisements')->where('id', $advertisementId)->first();
            abort_unless($row, 404, 'Advertisement not found.');
            abort_unless((bool) $row->active, 422, 'Choose an active advertisement.');

            $type = ($row->ad_type ?? 'image') === 'embed' ? 'embed' : 'image';
            if ($type === 'embed') {
                abort_if(trim((string) ($row->embed_code ?? '')) === '', 422, 'This Embed Code advertisement has no embed code.');
            } else {
                abort_if(trim((string) ($row->target_url ?? '')) === '', 422, 'An Image advertisement needs a destination URL for this click placement.');
            }

            $exists = DB::table('advertisement_placements')->where('placement_key', self::PLACEMENT)->exists();
            if ($exists) {
                DB::table('advertisement_placements')->where('placement_key', self::PLACEMENT)->update([
                    'advertisement_id' => $advertisementId,
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('advertisement_placements')->insert([
                    'placement_key' => self::PLACEMENT,
                    'advertisement_id' => $advertisementId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        return response()->json([
            'ok' => true,
            'placement_key' => self::PLACEMENT,
            'advertisement_id' => $advertisementId,
        ]);
    }
}
