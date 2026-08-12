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

    private const IMAGE_EXTENSIONS = [
        'jpg','jpeg','png','webp','gif','avif','svg','bmp','ico',
        'heic','heif','tif','tiff','jxl','jfif','pjpeg','pjp',
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
        $clientExtension = strtolower(trim((string) $file->getClientOriginalExtension()));
        $looksLikeImage = str_starts_with($mime, 'image/') || in_array($clientExtension, self::IMAGE_EXTENSIONS, true);
        abort_unless($looksLikeImage, 422, 'Please select an image file.');

        [$content, $mime, $extension] = $this->browserReadyImage($content, $mime);

        $filename = Str::uuid()->toString().'.'.$extension;
        $path = 'course-images/'.$filename;
        abort_unless(Storage::disk('local')->put($path, $content), 500, 'The course image could not be saved.');

        return response()->json([
            'ok' => true,
            'url' => '/api/course-images/'.$filename,
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

    private function browserReadyImage(string $content, string $mime): array
    {
        if (isset(self::BROWSER_MIMES[$mime])) {
            return [$content, $mime, self::BROWSER_MIMES[$mime]];
        }

        // Convert less browser-friendly image formats (HEIC/HEIF/TIFF etc.)
        // to WebP whenever ImageMagick is available on the server.
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
                // Try GD next.
            }
        }

        // GD provides another conversion path for any image format it can decode.
        if (function_exists('imagecreatefromstring') && function_exists('imagewebp')) {
            $bufferLevel = ob_get_level();
            try {
                $gd = @imagecreatefromstring($content);
                if ($gd !== false) {
                    ob_start();
                    imagewebp($gd, null, 88);
                    $converted = (string) ob_get_clean();
                    imagedestroy($gd);
                    if ($converted !== '') {
                        return [$converted, 'image/webp', 'webp'];
                    }
                }
            } catch (Throwable) {
                // A clean validation response is returned below.
            } finally {
                while (ob_get_level() > $bufferLevel) {
                    @ob_end_clean();
                }
            }
        }

        abort(422, 'This image format cannot be converted for browser display on this server. Please use JPG, PNG, WebP, GIF, AVIF, SVG, BMP or ICO.');
    }
}
