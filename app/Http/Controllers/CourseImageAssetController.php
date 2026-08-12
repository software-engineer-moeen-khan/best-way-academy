<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class CourseImageAssetController extends Controller
{
    private const MAX_KILOBYTES = 12288; // 12 MB
    private const MAX_BYTES = 12582912; // 12 MB
    private const MAX_HTML_BYTES = 4194304; // 4 MB
    private const MAX_REDIRECTS = 4;

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

        return $this->storeImage($content, $mime);
    }

    public function importUrl(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $data = $request->validate([
            'url' => ['required', 'string', 'max:4000'],
        ]);

        $url = $this->normaliseUrl((string) $data['url']);
        [$effectiveUrl, $response] = $this->fetchRemote($url);
        $body = $response->body();
        $mime = $this->detectMime((string) $response->header('Content-Type'), $body);

        if (str_starts_with($mime, 'image/')) {
            return $this->storeImage($body, $mime, $url);
        }

        if (!$this->isHtml($mime, $body)) {
            abort(422, 'That URL did not return an image. Paste a public image URL or an image page such as Unsplash.');
        }

        abort_if(strlen($body) > self::MAX_HTML_BYTES, 413, 'The image page is too large to inspect.');
        $imageUrl = $this->extractImageUrl($body, $effectiveUrl);
        abort_unless($imageUrl, 422, 'No usable image could be found on that page. Try the direct image URL instead.');

        [, $imageResponse] = $this->fetchRemote($imageUrl);
        $imageBody = $imageResponse->body();
        $imageMime = $this->detectMime((string) $imageResponse->header('Content-Type'), $imageBody);
        abort_unless(str_starts_with($imageMime, 'image/'), 422, 'The image found on that page is not browser-compatible.');

        return $this->storeImage($imageBody, $imageMime, $url);
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

    private function storeImage(string $content, string $mime, ?string $sourceUrl = null): JsonResponse
    {
        abort_if(strlen($content) > self::MAX_BYTES, 413, 'Image is larger than 12 MB.');
        [$content, $mime, $extension] = $this->browserReadyImage($content, strtolower(trim($mime)));

        $filename = Str::uuid()->toString().'.'.$extension;
        $path = 'course-images/'.$filename;
        abort_unless(Storage::disk('local')->put($path, $content), 500, 'The course image could not be saved.');

        return response()->json([
            'ok' => true,
            'url' => '/api/course-images/'.$filename,
            'filename' => $filename,
            'mime_type' => $mime,
            'size_bytes' => strlen($content),
            'source_url' => $sourceUrl,
        ], 201)->header('Cache-Control', 'no-store, no-cache, must-revalidate');
    }

    private function fetchRemote(string $url): array
    {
        $current = $url;

        for ($i = 0; $i <= self::MAX_REDIRECTS; $i++) {
            $this->assertPublicUrl($current);

            $response = Http::withHeaders([
                    'Accept' => 'image/avif,image/webp,image/apng,image/svg+xml,image/*,text/html,*/*;q=0.8',
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
                    'Referer' => $this->origin($current),
                ])
                ->connectTimeout(6)
                ->timeout(15)
                ->withOptions(['allow_redirects' => false])
                ->get($current);

            if ($response->status() >= 300 && $response->status() < 400) {
                $location = trim((string) $response->header('Location'));
                abort_if($location === '', 502, 'Image host returned an invalid redirect.');
                $current = $this->resolveUrl($current, $location);
                continue;
            }

            abort_unless($response->successful(), 422, 'The image URL could not be loaded by the server.');
            abort_if(strlen($response->body()) > self::MAX_BYTES, 413, 'Image is larger than 12 MB.');

            return [$current, $response];
        }

        abort(422, 'Too many redirects while loading the image URL.');
    }

    private function normaliseUrl(string $value): string
    {
        $value = trim($value);
        if (str_starts_with($value, '//')) {
            $value = 'https:'.$value;
        } elseif (!preg_match('~^https?://~i', $value) && preg_match('~^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$~i', $value)) {
            $value = 'https://'.$value;
        }

        if (!filter_var($value, FILTER_VALIDATE_URL)) {
            throw ValidationException::withMessages(['url' => 'Enter a valid public image URL.']);
        }

        $scheme = strtolower((string) parse_url($value, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) {
            throw ValidationException::withMessages(['url' => 'Only HTTP and HTTPS image URLs are supported.']);
        }

        return $value;
    }

    private function assertPublicUrl(string $url): void
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        abort_if($host === '' || $host === 'localhost' || str_ends_with($host, '.local') || str_ends_with($host, '.internal'), 422, 'This image host is not allowed.');

        $ips = [];
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            $ips[] = $host;
        } else {
            $resolved = gethostbynamel($host);
            if (is_array($resolved)) $ips = $resolved;
        }

        abort_if(!$ips, 422, 'The image host could not be resolved.');
        foreach ($ips as $ip) {
            abort_if(!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE), 422, 'Private or local image hosts are not allowed.');
        }
    }

    private function detectMime(string $header, string $body): string
    {
        $mime = strtolower(trim(explode(';', $header)[0] ?? ''));
        if ($mime !== '' && $mime !== 'application/octet-stream') return $mime;

        if (class_exists(\finfo::class)) {
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $detected = strtolower((string) $finfo->buffer($body));
            if ($detected !== '') return $detected;
        }

        return $mime;
    }

    private function isHtml(string $mime, string $body): bool
    {
        if (in_array($mime, ['text/html', 'application/xhtml+xml'], true)) return true;
        $sample = strtolower(substr(ltrim($body), 0, 500));
        return str_contains($sample, '<html') || str_contains($sample, '<!doctype html');
    }

    private function extractImageUrl(string $html, string $baseUrl): ?string
    {
        $candidates = [];

        if (class_exists(\DOMDocument::class)) {
            $previous = libxml_use_internal_errors(true);
            $dom = new \DOMDocument();
            @$dom->loadHTML($html, LIBXML_NOWARNING | LIBXML_NOERROR | LIBXML_NONET);
            $xpath = new \DOMXPath($dom);

            foreach ($xpath->query('//meta[@content]') ?: [] as $meta) {
                $key = strtolower(trim((string) ($meta->getAttribute('property') ?: $meta->getAttribute('name') ?: $meta->getAttribute('itemprop'))));
                if (in_array($key, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src', 'image'], true)) {
                    $candidates[] = trim((string) $meta->getAttribute('content'));
                }
            }

            if (!$candidates) {
                foreach ($xpath->query('//img[@src]') ?: [] as $img) {
                    $src = trim((string) $img->getAttribute('src'));
                    if ($src !== '') {
                        $candidates[] = $src;
                        break;
                    }
                }
            }

            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }

        if (!$candidates && preg_match('~<meta[^>]+(?:property|name)=["\'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["\'][^>]+content=["\']([^"\']+)["\']~i', $html, $match)) {
            $candidates[] = html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        foreach ($candidates as $candidate) {
            $candidate = html_entity_decode(trim((string) $candidate), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if ($candidate === '' || str_starts_with($candidate, 'data:')) continue;
            try {
                return $this->normaliseUrl($this->resolveUrl($baseUrl, $candidate));
            } catch (Throwable) {
                continue;
            }
        }

        return null;
    }

    private function resolveUrl(string $base, string $target): string
    {
        $target = trim($target);
        if (preg_match('~^https?://~i', $target)) return $target;

        $parts = parse_url($base);
        $scheme = $parts['scheme'] ?? 'https';
        $host = $parts['host'] ?? '';
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';

        if (str_starts_with($target, '//')) return $scheme.':'.$target;
        if (str_starts_with($target, '/')) return $scheme.'://'.$host.$port.$target;

        $path = $parts['path'] ?? '/';
        $directory = rtrim(str_replace('\\', '/', dirname($path)), '/');
        return $scheme.'://'.$host.$port.($directory ? $directory.'/' : '/').$target;
    }

    private function origin(string $url): string
    {
        $parts = parse_url($url);
        $scheme = $parts['scheme'] ?? 'https';
        $host = $parts['host'] ?? '';
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';
        return $scheme.'://'.$host.$port.'/';
    }

    private function browserReadyImage(string $content, string $mime): array
    {
        if (isset(self::BROWSER_MIMES[$mime])) {
            return [$content, $mime, self::BROWSER_MIMES[$mime]];
        }

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
                if ($converted !== '') return [$converted, 'image/webp', 'webp'];
            } catch (Throwable) {
                // Try GD next.
            }
        }

        if (function_exists('imagecreatefromstring') && function_exists('imagewebp')) {
            $bufferLevel = ob_get_level();
            try {
                $gd = @imagecreatefromstring($content);
                if ($gd !== false) {
                    ob_start();
                    imagewebp($gd, null, 88);
                    $converted = (string) ob_get_clean();
                    imagedestroy($gd);
                    if ($converted !== '') return [$converted, 'image/webp', 'webp'];
                }
            } catch (Throwable) {
                // A clean validation response is returned below.
            } finally {
                while (ob_get_level() > $bufferLevel) @ob_end_clean();
            }
        }

        abort(422, 'This image format cannot be converted for browser display on this server. Please use JPG, PNG, WebP, GIF, AVIF, SVG, BMP or ICO.');
    }
}
