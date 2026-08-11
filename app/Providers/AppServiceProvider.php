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

            // Replace Popular Skills with the certification showcase and the optional admin-selected LongBar ad.
            if ($event->request->getPathInfo() === '/' && (str_contains($html, 'class="popular"') || str_contains($html, "class='popular'"))) {
                $courseShowcase = <<<'HTML'
<section class="bwa-demand-skills" aria-labelledby="bwaDemandSkillsTitle">
  <div class="shell bwa-demand-skills-shell">
    <p class="bwa-demand-eyebrow">ONLINE COURSES</p>
    <h2 id="bwaDemandSkillsTitle">Learn In-Demand Skills, Anytime, Anywhere</h2>
    <p class="bwa-demand-subtitle">Explore industry-relevant courses designed to help you grow and succeed.</p>
    <div class="bwa-demand-grid">
      <a class="bwa-demand-card bwa-demand-card-purple" href="/course?course=cloud">
        <img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=85" alt="Cybersecurity and cloud security learning" loading="lazy">
        <div class="bwa-demand-card-body">
          <div class="bwa-demand-brand-row"><span class="bwa-demand-logo">C</span><div><h3>CompTIA</h3><p>Cloud &amp; Security</p></div></div>
          <span class="bwa-demand-rule"></span>
          <p class="bwa-demand-copy">Build in-demand IT skills and kickstart your cybersecurity career.</p>
          <span class="bwa-demand-cta">Start Learning <b>→</b></span>
        </div>
      </a>
      <a class="bwa-demand-card bwa-demand-card-blue" href="/course?course=cloud">
        <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=85" alt="Cloud servers for AWS learning" loading="lazy">
        <div class="bwa-demand-card-body">
          <div class="bwa-demand-brand-row"><span class="bwa-demand-logo">aws</span><div><h3>AWS</h3><p>Cloud Computing</p></div></div>
          <span class="bwa-demand-rule"></span>
          <p class="bwa-demand-copy">Master AWS services and build scalable cloud solutions with confidence.</p>
          <span class="bwa-demand-cta">Start Learning <b>→</b></span>
        </div>
      </a>
      <a class="bwa-demand-card bwa-demand-card-orange" href="/courses?category=Career">
        <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85" alt="Project management dashboard learning" loading="lazy">
        <div class="bwa-demand-card-body">
          <div class="bwa-demand-brand-row"><span class="bwa-demand-logo">PMI</span><div><h3>PMI</h3><p>Project Management</p></div></div>
          <span class="bwa-demand-rule"></span>
          <p class="bwa-demand-copy">Learn project management best practices and get PMI certified.</p>
          <span class="bwa-demand-cta">Start Learning <b>→</b></span>
        </div>
      </a>
    </div>
  </div>
</section>
HTML;

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

                $longbarAd = '';
                if ($advertisement) {
                    $type = ($advertisement->ad_type ?? 'image') === 'embed' ? 'embed' : 'image';
                    if ($type === 'embed' && trim((string) ($advertisement->embed_code ?? '')) !== '') {
                        $longbarAd = '<section class="homepage-longbar-ad" data-ad-placement="homepage_popular_skills_longbar"><div class="shell homepage-longbar-ad-inner homepage-longbar-ad-embed">'.(string) $advertisement->embed_code.'</div></section>';
                    } elseif ($type === 'image' && trim((string) ($advertisement->image_url ?? '')) !== '') {
                        $image = htmlspecialchars((string) $advertisement->image_url, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        $alt = htmlspecialchars(trim((string) ($advertisement->alt_text ?? $advertisement->name ?? 'Advertisement')), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                        $creative = '<img src="'.$image.'" alt="'.$alt.'" loading="lazy">';
                        $target = trim((string) ($advertisement->target_url ?? ''));
                        if ($target !== '') {
                            $href = htmlspecialchars($target, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                            $creative = '<a href="'.$href.'" target="_blank" rel="noopener noreferrer sponsored">'.$creative.'</a>';
                        }
                        $longbarAd = '<section class="homepage-longbar-ad" data-ad-placement="homepage_popular_skills_longbar"><div class="shell homepage-longbar-ad-inner">'.$creative.'</div></section>';
                    }
                }

                $replacement = $courseShowcase.$longbarAd;

                $html = preg_replace(
                    '~<section\s+class=(["\'])popular\1[^>]*>.*?</section>~is',
                    $replacement,
                    $html,
                    1
                ) ?? $html;

                if (!str_contains($html, 'data-bwa-demand-skills-style')) {
                    $style = <<<'HTML'
<style data-bwa-demand-skills-style>
.bwa-demand-skills{background:#020817;color:#fff;padding:48px 0 52px}
.bwa-demand-skills-shell{max-width:1500px}
.bwa-demand-eyebrow{margin:0 0 10px;color:#8b5cf6;font-size:16px;font-weight:800;letter-spacing:.08em}
.bwa-demand-skills h2{margin:0;font-size:clamp(34px,4.2vw,64px);line-height:1.05;letter-spacing:-.035em;color:#fff}
.bwa-demand-subtitle{margin:20px 0 34px;color:#c7cad3;font-size:clamp(17px,2vw,28px);line-height:1.45}
.bwa-demand-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.bwa-demand-card{min-width:0;overflow:hidden;border:1px solid #33405a;border-radius:24px;background:#081126;color:#fff;text-decoration:none;display:flex;flex-direction:column;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
.bwa-demand-card:hover{transform:translateY(-4px);border-color:#64748b;box-shadow:0 18px 38px rgba(0,0,0,.22)}
.bwa-demand-card>img{width:100%;height:280px;object-fit:cover;display:block}
.bwa-demand-card-body{padding:26px 28px 28px;display:flex;flex:1;flex-direction:column}
.bwa-demand-brand-row{display:flex;align-items:center;gap:18px}
.bwa-demand-logo{width:74px;height:74px;flex:0 0 74px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:23px;font-weight:900;background:#6d28d9;color:#fff;text-transform:none}
.bwa-demand-brand-row h3{margin:0 0 4px;font-size:34px;line-height:1;color:#fff}
.bwa-demand-brand-row p{margin:0;font-size:20px;font-weight:700;color:#9b6cff}
.bwa-demand-rule{display:block;width:78px;height:5px;border-radius:99px;background:#7c3aed;margin:26px 0 20px}
.bwa-demand-copy{margin:0;color:#f3f4f6;font-size:19px;line-height:1.55;min-height:88px}
.bwa-demand-cta{margin-top:auto;padding-top:28px;color:#9b6cff;font-size:22px;font-weight:800;display:flex;align-items:center;gap:16px}
.bwa-demand-cta b{font-size:30px;line-height:1}
.bwa-demand-card-blue .bwa-demand-logo{background:#0759c7}.bwa-demand-card-blue .bwa-demand-brand-row p,.bwa-demand-card-blue .bwa-demand-cta{color:#4da3ff}.bwa-demand-card-blue .bwa-demand-rule{background:#2585e8}
.bwa-demand-card-orange .bwa-demand-logo{background:#f97316}.bwa-demand-card-orange .bwa-demand-brand-row p,.bwa-demand-card-orange .bwa-demand-cta{color:#ff8a22}.bwa-demand-card-orange .bwa-demand-rule{background:#f97316}
.homepage-longbar-ad{min-height:190px;padding:12px 0;background:#fff;display:flex;align-items:center;justify-content:center}
.homepage-longbar-ad-inner{width:100%;min-height:160px;overflow:hidden;display:flex;align-items:center;justify-content:center;margin:0 auto;text-align:center}
.homepage-longbar-ad a{display:flex;align-items:center;justify-content:center;width:auto;max-width:100%;text-decoration:none;margin:0 auto}
.homepage-longbar-ad img{display:block;width:auto;height:auto;max-width:100%;border:0;border-radius:14px;object-fit:contain;margin:0 auto}
.homepage-longbar-ad-embed{min-height:160px;display:flex;align-items:center;justify-content:center;text-align:center}
.homepage-longbar-ad-embed>*,.homepage-longbar-ad-embed iframe,.homepage-longbar-ad-embed img,.homepage-longbar-ad-embed video{max-width:100%;margin-left:auto!important;margin-right:auto!important}
@media(max-width:1050px){.bwa-demand-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bwa-demand-card:last-child{grid-column:1/-1;max-width:calc(50% - 12px);width:100%;justify-self:center}}
@media(max-width:780px){.bwa-demand-skills{padding:34px 0 38px}.bwa-demand-subtitle{margin:14px 0 24px}.bwa-demand-grid{grid-template-columns:1fr;gap:18px}.bwa-demand-card:last-child{grid-column:auto;max-width:none}.bwa-demand-card>img{height:210px}.bwa-demand-card-body{padding:20px}.bwa-demand-logo{width:60px;height:60px;flex-basis:60px;font-size:18px}.bwa-demand-brand-row h3{font-size:27px}.bwa-demand-brand-row p{font-size:17px}.bwa-demand-copy{font-size:16px;min-height:0}.bwa-demand-cta{font-size:18px;padding-top:22px}.homepage-longbar-ad{min-height:118px;padding:8px 0}.homepage-longbar-ad-inner,.homepage-longbar-ad-embed{min-height:100px}.homepage-longbar-ad img{border-radius:10px}}
</style>
HTML;
                    $html = str_ireplace('</head>', $style.PHP_EOL.'</head>', $html);
                }
            }

            $response->setContent($html);
        });
    }
}
