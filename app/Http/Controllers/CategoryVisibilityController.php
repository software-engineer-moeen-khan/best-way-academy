<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CategoryVisibilityController extends Controller
{
    public function update(Request $request, int $category): JsonResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $data = $request->validate([
            'active' => ['required', 'boolean'],
        ]);

        $row = DB::table('course_categories')->where('id', $category)->first();
        abort_unless($row, 404);

        DB::table('course_categories')->where('id', $category)->update([
            'active' => (bool) $data['active'],
            'updated_at' => now(),
        ]);

        return response()->json([
            'ok' => true,
            'category' => [
                'id' => (int) $category,
                'name' => (string) $row->name,
                'active' => (bool) $data['active'],
            ],
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
}
