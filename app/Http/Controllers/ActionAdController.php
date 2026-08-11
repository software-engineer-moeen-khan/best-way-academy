<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActionAdController extends Controller
{
    private const ENROLL_PLACEMENT = 'course_enroll_now_ad';
    private const COUPON_PLACEMENT = 'checkout_coupon_apply_ad';

    private function payload(?object $row): ?array
    {
        if (!$row) {
            return null;
        }

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

    private function selected(string $placement): ?object
    {
        return DB::table('advertisement_placements as ap')
            ->join('advertisements as a', 'a.id', '=', 'ap.advertisement_id')
            ->where('ap.placement_key', $placement)
            ->where('a.active', true)
            ->select('a.*')
            ->first();
    }

    public function show(): JsonResponse
    {
        return response()->json([
            'enroll_now' => $this->payload($this->selected(self::ENROLL_PLACEMENT)),
            'coupon_apply' => $this->payload($this->selected(self::COUPON_PLACEMENT)),
        ])->header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    private function assign(Request $request, string $placement): JsonResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $data = $request->validate([
            'advertisement_id' => ['nullable', 'integer'],
        ]);
        $advertisementId = isset($data['advertisement_id']) ? (int) $data['advertisement_id'] : null;

        DB::transaction(function () use ($advertisementId, $placement): void {
            if (!$advertisementId) {
                DB::table('advertisement_placements')->where('placement_key', $placement)->delete();
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

            $existing = DB::table('advertisement_placements')->where('placement_key', $placement)->exists();
            if ($existing) {
                DB::table('advertisement_placements')->where('placement_key', $placement)->update([
                    'advertisement_id' => $advertisementId,
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('advertisement_placements')->insert([
                    'placement_key' => $placement,
                    'advertisement_id' => $advertisementId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        return response()->json([
            'ok' => true,
            'placement_key' => $placement,
            'advertisement_id' => $advertisementId,
        ]);
    }

    public function assignEnroll(Request $request): JsonResponse
    {
        return $this->assign($request, self::ENROLL_PLACEMENT);
    }

    public function assignCoupon(Request $request): JsonResponse
    {
        return $this->assign($request, self::COUPON_PLACEMENT);
    }
}
