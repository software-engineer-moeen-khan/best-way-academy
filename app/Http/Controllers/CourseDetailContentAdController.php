<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CourseDetailContentAdController extends Controller
{
    private const PLACEMENT_KEY = 'course_detail_before_learn_ad';

    private function admin(Request $request): User
    {
        $user = $request->user();
        abort_unless($user?->role === 'admin', 403);
        return $user;
    }

    private function payload(object $row): array
    {
        return [
            'id' => (int) $row->id,
            'name' => (string) $row->name,
            'ad_type' => ($row->ad_type ?? 'image') === 'embed' ? 'embed' : 'image',
            'image_url' => $row->image_url,
            'embed_code' => $row->embed_code ?? null,
            'target_url' => $row->target_url,
            'alt_text' => $row->alt_text,
            'active' => (bool) $row->active,
            'placement_key' => self::PLACEMENT_KEY,
        ];
    }

    private function current(): ?object
    {
        return DB::table('advertisement_placements as ap')
            ->join('advertisements as a', 'a.id', '=', 'ap.advertisement_id')
            ->where('ap.placement_key', self::PLACEMENT_KEY)
            ->where('a.active', true)
            ->select('a.*')
            ->first();
    }

    public function show(): JsonResponse
    {
        $row = $this->current();

        return response()->json([
            'advertisement' => $row ? $this->payload($row) : null,
        ])->header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    public function assign(Request $request): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate([
            'advertisement_id' => ['nullable', 'integer'],
        ]);
        $advertisementId = isset($data['advertisement_id']) ? (int) $data['advertisement_id'] : null;

        DB::transaction(function () use ($advertisementId): void {
            if (!$advertisementId) {
                DB::table('advertisement_placements')->where('placement_key', self::PLACEMENT_KEY)->delete();
                return;
            }

            $row = DB::table('advertisements')->where('id', $advertisementId)->first();
            abort_unless($row, 404, 'Advertisement not found.');
            abort_unless((bool) $row->active, 422, 'Choose an active advertisement.');

            $type = ($row->ad_type ?? 'image') === 'embed' ? 'embed' : 'image';
            if ($type === 'embed') {
                abort_if(trim((string) ($row->embed_code ?? '')) === '', 422, 'This Embed Code advertisement has no embed code.');
            } else {
                abort_if(trim((string) ($row->image_url ?? '')) === '', 422, 'This Image advertisement has no image URL.');
            }

            $exists = DB::table('advertisement_placements')->where('placement_key', self::PLACEMENT_KEY)->exists();
            if ($exists) {
                DB::table('advertisement_placements')->where('placement_key', self::PLACEMENT_KEY)->update([
                    'advertisement_id' => $advertisementId,
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('advertisement_placements')->insert([
                    'placement_key' => self::PLACEMENT_KEY,
                    'advertisement_id' => $advertisementId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        return response()->json([
            'ok' => true,
            'placement_key' => self::PLACEMENT_KEY,
            'advertisement_id' => $advertisementId,
        ]);
    }
}
