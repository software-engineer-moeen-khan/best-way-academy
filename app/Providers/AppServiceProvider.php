<?php

namespace App\Providers;

use Illuminate\Foundation\Http\Events\RequestHandled;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Event::listen(RequestHandled::class, function (RequestHandled $event): void {
            $response = $event->response;
            $contentType = strtolower((string) $response->headers->get('Content-Type', ''));

            if (!str_contains($contentType, 'text/html')) {
                return;
            }

            $html = $response->getContent();
            if (!is_string($html) || $html === '') {
                return;
            }

            if ($event->request->is('admin') && !str_contains($html, 'admin-promo-message.js')) {
                $html = str_ireplace(
                    '</body>',
                    '<script src="/assets/admin-promo-message.js?rev=20260810-top-promo-v1"></script>'.PHP_EOL.'</body>',
                    $html
                );
            }

            if ($event->request->is('admin') && !str_contains($html, 'admin-homepage-categories.js')) {
                $html = str_ireplace(
                    '</body>',
                    '<script src="/assets/admin-homepage-categories.js?rev=20260810-homepage-categories-v1"></script>'.PHP_EOL.'</body>',
                    $html
                );
            }

            if ($event->request->is('admin') && !str_contains($html, 'admin-advertisements.js')) {
                $html = str_ireplace(
                    '</body>',
                    '<script src="/assets/admin-advertisements.js?rev=20260811-advertisements-v3"></script>'.PHP_EOL.'</body>',
                    $html
                );
            }

            if ($event->request->getPathInfo() === '/' && !str_contains($html, 'homepage-google-ai-popunder.js')) {
                $html = str_ireplace(
                    '</body>',
                    '<script src="/assets/homepage-google-ai-popunder.js?rev=20260811-google-ai-popunder-v1"></script>'.PHP_EOL.'</body>',
                    $html
                );
            }

            // Keep the public header intentionally small even if legacy scripts recreate old links.
            if (!$event->request->is('admin') && !str_contains($html, 'data-bwa-header-cleanup')) {
                $headerCleanup = <<<'HTML'
<style data-bwa-header-cleanup>
.desktop-nav a[href*="category=Artificial%20Intelligence"],
.desktop-nav a[href*="category=Artificial+Intelligence"],
.desktop-nav a[href*="category=Career"],
.site-header .suite-links a[href="/plans"],
.site-header .suite-links a[href="plans.html"],
.site-header .suite-links a[href="/plans.html"],
.site-header a[href="/plans"].nav-link,
.site-header a[href="plans.html"].nav-link,
.site-header a[href="/plans.html"].nav-link,
.mobile-nav a[href="/plans"],
.mobile-nav a[href="plans.html"],
.mobile-nav a[href="/plans.html"] {
    display: none !important;
}
</style>
HTML;
                $html = str_ireplace('</head>', $headerCleanup.PHP_EOL.'</head>', $html);
            }

            if (str_contains($html, 'class="promo"') || str_contains($html, "class='promo'")) {
                try {
                    $stored = DB::table('platform_settings')->where('key', 'promo_message')->value('value');
                } catch (Throwable) {
                    $stored = null;
                }

                if ($stored !== null) {
                    $message = (string) $stored;
                    if (is_string($stored)) {
                        $decoded = json_decode($stored, true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            $message = is_string($decoded) ? $decoded : (string) $decoded;
                        }
                    }

                    $message = trim($message);
                    $replacement = $message === ''
                        ? '<div class="promo" hidden></div>'
                        : '<div class="promo">'.htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'</div>';

                    $html = preg_replace(
                        '~<div\s+class=(["\'])promo\1[^>]*>.*?</div>~is',
                        $replacement,
                        $html,
                        1
                    ) ?? $html;
                }
            }

            // Render the homepage skills/category cards directly from MySQL so admin changes are visible on the next page load.
            if (str_contains($html, 'class="skill-panels"') || str_contains($html, "class='skill-panels'")) {
                try {
                    $categories = DB::table('course_categories')
                        ->where('active', true)
                        ->orderBy('position')
                        ->orderBy('name')
                        ->get(['id', 'name', 'description']);

                    $storedIds = DB::table('platform_settings')->where('key', 'homepage_category_ids')->value('value');
                    $selectedIds = is_string($storedIds) ? json_decode($storedIds, true) : $storedIds;
                    $selectedIds = is_array($selectedIds) ? array_values(array_unique(array_map('intval', $selectedIds))) : [];

                    if (!$selectedIds) {
                        $preferred = ['Artificial Intelligence', 'Development', 'Data', 'Marketing'];
                        $byName = $categories->keyBy('name');
                        foreach ($preferred as $name) {
                            if (isset($byName[$name])) {
                                $selectedIds[] = (int) $byName[$name]->id;
                            }
                        }
                        foreach ($categories as $category) {
                            if (count($selectedIds) >= 4) {
                                break;
                            }
                            $id = (int) $category->id;
                            if (!in_array($id, $selectedIds, true)) {
                                $selectedIds[] = $id;
                            }
                        }
                    }

                    $byId = $categories->keyBy(fn ($category) => (int) $category->id);
                    $cards = [];
                    foreach (array_slice($selectedIds, 0, 4) as $index => $id) {
                        $category = $byId->get((int) $id);
                        if (!$category) {
                            continue;
                        }
                        $name = htmlspecialchars((string) $category->name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        $description = trim((string) ($category->description ?? ''));
                        if ($description === '') {
                            $description = 'Explore courses and practical skills in this category.';
                        }
                        $description = htmlspecialchars($description, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        $href = '/courses?category='.rawurlencode((string) $category->name);
                        $number = str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT);
                        $cards[] = '<a class="skill-panel" href="'.$href.'"><span>'.$number.'</span><h3>'.$name.'</h3><p>'.$description.'</p></a>';
                    }

                    if ($cards) {
                        $replacement = '<div class="skill-panels">'.implode('', $cards).'</div>';
                        $html = preg_replace(
                            '~<div\s+class=(["\'])skill-panels\1[^>]*>.*?</div>~is',
                            $replacement,
                            $html,
                            1
                        ) ?? $html;
                    }
                } catch (Throwable) {
                    // Keep the static fallback cards if the database is unavailable.
                }
            }

            $response->setContent($html);
        });
    }
}
