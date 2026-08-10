<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminAdvertisementController extends Controller
{
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

    private function payload(object $row): array
    {
        return [
            'id' => (int) $row->id,
            'name' => $row->name,
            'image_url' => $row->image_url,
            'target_url' => $row->target_url,
            'alt_text' => $row->alt_text,
            'placement_key' => $row->placement_key,
            'active' => (bool) $row->active,
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
        ];
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
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'image_url' => ['required', 'string', 'max:2048'],
            'target_url' => ['nullable', 'string', 'max:2048'],
            'alt_text' => ['nullable', 'string', 'max:255'],
            'active' => ['required', 'boolean'],
        ]);

        $now = now();
        $id = DB::table('advertisements')->insertGetId([
            'name' => trim($data['name']),
            'image_url' => $this->cleanLink($data['image_url'], true),
            'target_url' => $this->cleanLink($data['target_url'] ?? null),
            'alt_text' => trim((string) ($data['alt_text'] ?? '')) ?: null,
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

        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'image_url' => ['required', 'string', 'max:2048'],
            'target_url' => ['nullable', 'string', 'max:2048'],
            'alt_text' => ['nullable', 'string', 'max:255'],
            'active' => ['required', 'boolean'],
        ]);

        DB::table('advertisements')->where('id', $advertisement)->update([
            'name' => trim($data['name']),
            'image_url' => $this->cleanLink($data['image_url'], true),
            'target_url' => $this->cleanLink($data['target_url'] ?? null),
            'alt_text' => trim((string) ($data['alt_text'] ?? '')) ?: null,
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
