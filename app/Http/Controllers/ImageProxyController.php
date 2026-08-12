<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\Response as HttpResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class ImageProxyController extends Controller
{
    private const MAX_IMAGE_BYTES = 12582912; // 12 MB
    private const MAX_HTML_BYTES = 4194304;   // 4 MB
    private const MAX_REDIRECTS = 4;

    public function __invoke(Request $request)
    {
        $raw = trim((string) $request->query('url', ''));
        if ($raw === '') {
            abort(422, 'Image URL is required.');
        }

        $url = $this->normaliseUrl($raw);
        [$effectiveUrl, $remote] = $this->fetch($url);
        $mime = $this->mime($remote);

        if ($this->isImageMime($mime)) {
            return $this->imageResponse($remote->body(), $mime);
        }

        if (!$this->isHtml($mime, $remote->body())) {
            abort(415, 'The supplied URL is not an image or image page.');
        }

        $html = $remote->body();
        if (strlen($html) > self::MAX_HTML_BYTES) {
            abort(413, 'Image page is too large to inspect.');
        }

        $imageUrl = $this->extractImageUrl($html, $effectiveUrl);
        if (!$imageUrl) {
            abort(422, 'No usable image was found on that page.');
        }

        [$imageEffectiveUrl, $image] = $this->fetch($imageUrl);
        $imageMime = $this->mime($image);
        if (!$this->isImageMime($imageMime)) {
            abort(415, 'The page image is not in a supported image format.');
        }

        return $this->imageResponse($image->body(), $imageMime)
            ->header('X-BWA-Image-Source', $this->safeHeaderValue($imageEffectiveUrl));
    }

    private function fetch(string $url): array
    {
        $current = $url;

        for ($i = 0; $i <= self::MAX_REDIRECTS; $i++) {
            $this->assertPublicUrl($current);

            $response = Http::withHeaders([
                    'Accept' => 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
                    'Referer' => $this->origin($current),
                ])
                ->connectTimeout(5)
                ->timeout(12)
                ->withOptions(['allow_redirects' => false])
                ->get($current);

            if ($response->status() >= 300 && $response->status() < 400) {
                $location = trim((string) $response->header('Location'));
                if ($location === '') {
                    abort(502, 'Image host returned an invalid redirect.');
                }
                $current = $this->resolveUrl($current, $location);
                continue;
            }

            if (!$response->successful()) {
                abort(502, 'The image host could not be reached.');
            }

            $length = (int) ($response->header('Content-Length') ?: 0);
            if ($length > self::MAX_IMAGE_BYTES || strlen($response->body()) > self::MAX_IMAGE_BYTES) {
                abort(413, 'Image is too large.');
            }

            return [$current, $response];
        }

        abort(508, 'Too many redirects while loading the image.');
    }

    private function normaliseUrl(string $value): string
    {
        if (str_starts_with($value, '//')) {
            $value = 'https:'.$value;
        } elseif (!preg_match('~^https?://~i', $value) && preg_match('~^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$~i', $value)) {
            $value = 'https://'.$value;
        }

        if (!filter_var($value, FILTER_VALIDATE_URL)) {
            throw ValidationException::withMessages(['url' => 'Enter a valid image or webpage URL.']);
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
        if ($host === '' || $host === 'localhost' || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
            abort(422, 'This image host is not allowed.');
        }

        $ips = [];
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            $ips[] = $host;
        } else {
            $resolved = gethostbynamel($host);
            if (is_array($resolved)) {
                $ips = $resolved;
            }
        }

        if (!$ips) {
            abort(422, 'The image host could not be resolved.');
        }

        foreach ($ips as $ip) {
            if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                abort(422, 'Private or local image hosts are not allowed.');
            }
        }
    }

    private function mime(HttpResponse $response): string
    {
        $type = strtolower(trim(explode(';', (string) $response->header('Content-Type'))[0] ?? ''));
        if ($type !== '' && $type !== 'application/octet-stream') {
            return $type;
        }

        if (class_exists(\finfo::class)) {
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $detected = strtolower((string) $finfo->buffer($response->body()));
            if ($detected !== '') {
                return $detected;
            }
        }

        return $type;
    }

    private function isImageMime(string $mime): bool
    {
        return str_starts_with($mime, 'image/');
    }

    private function isHtml(string $mime, string $body): bool
    {
        if (in_array($mime, ['text/html', 'application/xhtml+xml'], true)) {
            return true;
        }
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

            foreach ($xpath->query('//link[@href]') ?: [] as $link) {
                $rel = strtolower(trim((string) $link->getAttribute('rel')));
                if (in_array($rel, ['image_src', 'preload'], true) && ($rel !== 'preload' || strtolower($link->getAttribute('as')) === 'image')) {
                    $candidates[] = trim((string) $link->getAttribute('href'));
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
            if ($candidate === '' || str_starts_with($candidate, 'data:')) {
                continue;
            }
            try {
                return $this->normaliseUrl($this->resolveUrl($baseUrl, $candidate));
            } catch (\Throwable) {
                continue;
            }
        }

        return null;
    }

    private function resolveUrl(string $base, string $target): string
    {
        $target = trim($target);
        if (preg_match('~^https?://~i', $target)) {
            return $target;
        }

        $parts = parse_url($base);
        $scheme = $parts['scheme'] ?? 'https';
        $host = $parts['host'] ?? '';
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';

        if (str_starts_with($target, '//')) {
            return $scheme.':'.$target;
        }

        if (str_starts_with($target, '/')) {
            return $scheme.'://'.$host.$port.$target;
        }

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

    private function imageResponse(string $body, string $mime)
    {
        return response($body, 200)
            ->header('Content-Type', $mime ?: 'application/octet-stream')
            ->header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
            ->header('X-Content-Type-Options', 'nosniff')
            ->header('Cross-Origin-Resource-Policy', 'cross-origin');
    }

    private function safeHeaderValue(string $value): string
    {
        return str_replace(["\r", "\n"], '', $value);
    }
}
