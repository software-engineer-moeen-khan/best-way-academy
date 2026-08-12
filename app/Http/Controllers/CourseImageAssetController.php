<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class CourseImageAssetController extends Controller
{
    private const MAX_KILOBYTES = 12288; // 12 MB

    private const BROWSER_MIMES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'image/avif' => 'avif',
        'image/svg+xml' => 'svg',
        'image/bmp' => 'bmp',
        'image/x-ms-bmp' => 'bmp',
        'image/x-icon' => 'ico',
        'image/vnd.microsoft.icon' => 'ico',
    ];

    public function upload(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $request->validate([
            'image' => ['required', 'file', 'max:'.self::MAX_KILOBYTES],
        ]);

        $file = $request->file('image');
        abort_unless($file && $file->isValid(), 422, 'The selected image could not be uploaded.');

        $content = file_get_contents($file->getRealPath());
        abort_unless($content !== false && $content !== '', 422, 'The selected image is empty or unreadable.');

        $mime = strtolower(trim((string) ($file->getMimeType() ?: '')));
        abort_unless(str_starts_with($mime, 'image/'), 422, 'Please select an image file.');

        [$content, $mime, $extension] = $this->browserReadyImage($content, $mime, (string) $file->getClientOriginalExtension());

        $filename = Str::uuid()->toString().'.'.$extension;
        $path = 'course-images/'.$filename;
        abort_unless(Storage::disk('local')->put($path, $content), 500, 'The course image could not be saved.');

        $url = rtrim($request->getSchemeAndHttpHost(), '/').'/api/course-images/'.$filename;

        return response()->json([
            'ok' => true,
            'url' => $url,
            'filename' => $filename,
            'mime_type' => $mime,
            'size_bytes' => strlen($content),
        ], 201)->header('Cache-Control', 'no-store, no-cache, must-revalidate');
    }

    public function show(string $filename)
    {
        abort_unless((bool) preg_match('/^[a-f0-9-]{36}\.(?:jpg|jpeg|png|webp|gif|avif|svg|bmp|ico)$/i', $filename), 404);

        $path = 'course-images/'.$filename;
        abort_unless(Storage::disk('local')->exists($path), 404, 'Course image not found.');

        $content = Storage::disk('local')->get($path);
        $extension = strtolower((string) pathinfo($filename, PATHINFO_EXTENSION));
        $mime = match ($extension) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'avif' => 'image/avif',
            'svg' => 'image/svg+xml',
            'bmp' => 'image/bmp',
            'ico' => 'image/x-icon',
            default => 'application/octet-stream',
        };

        return response($content, 200, [
            'Content-Type' => $mime,
            'Content-Length' => (string) strlen($content),
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    private function browserReadyImage(string $content, string $mime, string $clientExtension): array
    {
        if (isset(self::BROWSER_MIMES[$mime])) {
            return [$content, $mime, self::BROWSER_MIMES[$mime]];
        }

        // When Imagick is available, convert less browser-friendly image formats
        // (for example HEIC/HEIF/TIFF) to WebP so they can still be shown as course images.
        if (class_exists(\Imagick::class)) {
            try {
                $image = new \Imagick();
                $image->readImageBlob($content);
                $image->setIteratorIndex(0);
                $image->setImageFormat('webp');
                $image->setImageCompressionQuality(88);
                $image->stripImage();
                $converted = $image->getImageBlob();
                $image->clear();
                $image->destroy();
                if ($converted !== '') {
                    return [$converted, 'image/webp', 'webp'];
                }
            } catch (Throwable) {
                // Fall through to a clear validation response below.
            }
        }

        $extension = strtolower(trim($clientExtension));
        if ($extension !== '' && preg_match('/^[a-z0-9]{2,5}$/', $extension) && str_starts_with($mime, 'image/')) {
            // Keep image/* formats that the current browser/server may support even if
            // they are not in our common list. The public endpoint preserves the file.
            // Unknown extensions are stored as WebP only when Imagick can convert them.
            abort(422, 'This image format is not browser-ready on this server. Please use JPG, PNG, WebP, GIF, AVIF, SVG, BMP or ICO.');
        }

        abort(422, 'Unsupported image format. Please upload a standard image file.');
    }
}
