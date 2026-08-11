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
                    '<script src="/assets/admin-advertisements.js?rev=20260811-advertisements-v4"></script>'.PHP_EOL.'</body>',
                    $html
                );
            }

            if (($event->request->is('admin') || $event->request->getPathInfo() === '/') && !str_contains($html, 'ai-career-ad.js')) {
                $html = str_ireplace(
                    '</body>',
                    '<script src="/assets/ai-career-ad.js?rev=20260812-ai-career-ad-v1"></script>'.PHP_EOL.'</body>',
                    $html
                );
            }

            if ($event->request->getPathInfo() === '/' && !str_contains($html, 'homepage-google-ai-popunder.js')) {
                $html = str_ireplace(
                    '</body>',
                    '<script src="/assets/homepage-google-ai-popunder.js?rev=20260811-google-ai-popunder-v3"></script>'.PHP_EOL.'</body>',
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

            // Replace the complete Popular Skills section with the admin-selected LongBar advertisement.
            if ($event->request->getPathInfo() === '/' && (str_contains($html, 'class="popular"') || str_contains($html, "class='popular'"))) {
                $advertisement = null;
                try {
                    $advertisement = DB::table('advertisement_placements as ap')
                        ->join('advertisements as a', 'a.id', '=', 'ap.advertisement_id')
                        ->where('ap.placement_key', 'homepage_popular_skills_longbar')
                        ->where('a.active', true)
                        ->select('a.*')
                        ->first();
                } catch (Throwable) {
                    $advertisement = null;
                }

                $replacement = '';
                if ($advertisement) {
                    $type = ($advertisement->ad_type ?? 'image') === 'embed' ? 'embed' : 'image';
                    if ($type === 'embed' && trim((string) ($advertisement->embed_code ?? '')) !== '') {
                        $replacement = '<section class="homepage-longbar-ad" data-ad-placement="homepage_popular_skills_longbar"><div class="shell homepage-longbar-ad-inner homepage-longbar-ad-embed">'.(string) $advertisement->embed_code.'</div></section>';
                    } elseif ($type === 'image' && trim((string) ($advertisement->image_url ?? '')) !== '') {
                        $image = htmlspecialchars((string) $advertisement->image_url, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        $alt = htmlspecialchars(trim((string) ($advertisement->alt_text ?? $advertisement->name ?? 'Advertisement')), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        $creative = '<img src="'.$image.'" alt="'.$alt.'" loading="lazy">';
                        $target = trim((string) ($advertisement->target_url ?? ''));
                        if ($target !== '') {
                            $href = htmlspecialchars($target, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                            $creative = '<a href="'.$href.'" target="_blank" rel="noopener noreferrer sponsored">'.$creative.'</a>';
                        }
                        $replacement = '<section class="homepage-longbar-ad" data-ad-placement="homepage_popular_skills_longbar"><div class="shell homepage-longbar-ad-inner">'.$creative.'</div></section>';
                    }
                }

                $html = preg_replace(
                    '~<section\s+class=(["\'])popular\1[^>]*>.*?</section>~is',
                    $replacement,
                    $html,
                    1
                ) ?? $html;

                if ($replacement !== '' && !str_contains($html, 'data-bwa-longbar-ad-style')) {
                    $style = <<<'HTML'
<style data-bwa-longbar-ad-style>
.homepage-longbar-ad{min-height:210px;padding:14px 0;background:transparent;display:flex;align-items:center;justify-content:center}
.homepage-longbar-ad-inner{width:100%;min-height:170px;overflow:hidden;display:flex;align-items:center;justify-content:center;margin:0 auto;text-align:center}
.homepage-longbar-ad a{display:flex;align-items:center;justify-content:center;width:auto;max-width:100%;text-decoration:none;margin:0 auto}
.homepage-longbar-ad img{display:block;width:auto;height:auto;max-width:100%;border:0;border-radius:14px;object-fit:contain;margin:0 auto}
.homepage-longbar-ad-embed{min-height:170px;display:flex;align-items:center;justify-content:center;text-align:center}
.homepage-longbar-ad-embed>*,.homepage-longbar-ad-embed iframe,.homepage-longbar-ad-embed img,.homepage-longbar-ad-embed video{max-width:100%;margin-left:auto!important;margin-right:auto!important}
@media(max-width:780px){.homepage-longbar-ad{min-height:128px;padding:10px 0}.homepage-longbar-ad-inner,.homepage-longbar-ad-embed{min-height:108px}.homepage-longbar-ad img{border-radius:10px}}
</style>
HTML;
                    $html = str_ireplace('</head>', $style.PHP_EOL.'</head>', $html);
                }
            }

            $response->setContent($html);
        });
    }
}
