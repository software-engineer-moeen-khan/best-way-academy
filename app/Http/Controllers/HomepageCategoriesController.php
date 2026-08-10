<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HomepageCategoriesController extends Controller
{
    private const SETTING_KEY = 'homepage_category_ids';

    private function admin(Request $request): User
    {
        $user = $request->user();
        abort_unless($user?->role === 'admin', 403);

        return $user;
    }

    private function activeCategories()
    {
        return DB::table('course_categories')
            ->where('active', true)
            ->orderBy('position')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'description', 'icon', 'position']);
    }

    private function defaultIds($categories): array
    {
        $preferred = ['Artificial Intelligence', 'Development', 'Data', 'Marketing'];
        $byName = $categories->keyBy('name');
        $ids = [];

        foreach ($preferred as $name) {
            if (isset($byName[$name])) {
                $ids[] = (int) $byName[$name]->id;
            }
        }

        foreach ($categories as $category) {
            $id = (int) $category->id;
            if (count($ids) >= 4) {
                break;
            }
            if (!in_array($id, $ids, true)) {
                $ids[] = $id;
            }
        }

        return array_slice($ids, 0, 4);
    }

    private function selectedIds($categories): array
    {
        $stored = DB::table('platform_settings')->where('key', self::SETTING_KEY)->value('value');
        if ($stored === null) {
            return $this->defaultIds($categories);
        }

        $decoded = is_string($stored) ? json_decode($stored, true) : $stored;
        if (!is_array($decoded)) {
            return $this->defaultIds($categories);
        }

        $activeIds = $categories->pluck('id')->map(fn ($id) => (int) $id)->all();
        $ids = [];
        foreach ($decoded as $raw) {
            $id = (int) $raw;
            if ($id > 0 && in_array($id, $activeIds, true) && !in_array($id, $ids, true)) {
                $ids[] = $id;
            }
            if (count($ids) >= 4) {
                break;
            }
        }

        return $ids ?: $this->defaultIds($categories);
    }

    public function show(Request $request): JsonResponse
    {
        $this->admin($request);
        $categories = $this->activeCategories();

        return response()->json([
            'categories' => $categories,
            'selected_ids' => $this->selectedIds($categories),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate([
            'category_ids' => ['required', 'array', 'min:1', 'max:4'],
            'category_ids.*' => ['required', 'integer', 'distinct'],
        ]);

        $ids = array_values(array_map('intval', $data['category_ids']));
        $validCount = DB::table('course_categories')
            ->where('active', true)
            ->whereIn('id', $ids)
            ->count();

        abort_unless($validCount === count($ids), 422, 'Choose only active categories.');

        $now = now();
        $value = json_encode($ids, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $exists = DB::table('platform_settings')->where('key', self::SETTING_KEY)->exists();

        if ($exists) {
            DB::table('platform_settings')->where('key', self::SETTING_KEY)->update([
                'value' => $value,
                'updated_at' => $now,
            ]);
        } else {
            DB::table('platform_settings')->insert([
                'key' => self::SETTING_KEY,
                'value' => $value,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        return response()->json([
            'ok' => true,
            'selected_ids' => $ids,
        ]);
    }
}
