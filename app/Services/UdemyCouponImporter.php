<?php

namespace App\Services;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

class UdemyCouponImporter
{
    private const SOURCE_BASE = 'https://www.couponami.com';

    /**
     * Ordered deliberately: Biomedical is always processed first.
     *
     * Keep queries fairly focused. A course can appear in several searches,
     * but global de-duplication makes sure it is only claimed once per run.
     */
    private const CATEGORY_QUERIES = [
        'Biomedical' => [
            'biomedical', 'medical', 'healthcare', 'biology', 'anatomy', 'physiology',
            'pharmacology', 'clinical', 'oncology', 'cancer', 'genetics', 'microbiology',
            'bacteriology', 'mycology', 'nursing', 'medical ethics', 'public health',
        ],
        'Development' => [
            'web development', 'php', 'laravel', 'javascript', 'typescript', 'react',
            'vue', 'angular', 'nodejs', 'python', 'java', 'c sharp', 'dotnet',
        ],
        'Artificial Intelligence' => [
            'artificial intelligence', 'machine learning', 'deep learning', 'chatgpt',
            'generative ai', 'llm', 'prompt engineering', 'computer vision', 'nlp',
        ],
        'Data Science & Analytics' => [
            'data science', 'data analysis', 'data analytics', 'pandas', 'numpy',
            'statistics', 'tableau', 'power bi', 'business intelligence',
        ],
        'Cyber Security' => [
            'cyber security', 'ethical hacking', 'network security', 'penetration testing',
            'web security', 'information security', 'soc', 'malware', 'kali linux',
        ],
        'Cloud & DevOps' => [
            'aws', 'azure', 'google cloud', 'devops', 'docker', 'kubernetes', 'terraform',
            'jenkins', 'ci cd', 'linux administration',
        ],
        'IT & Software' => [
            'it support', 'computer science', 'linux', 'windows server', 'networking',
            'system administration', 'technical support', 'api', 'git', 'github',
        ],
        'Mobile Development' => [
            'android development', 'ios development', 'flutter', 'react native', 'swift',
            'kotlin', 'mobile app development',
        ],
        'Database' => [
            'sql', 'mysql', 'postgresql', 'mongodb', 'database design', 'oracle database',
            'sql server', 'redis',
        ],
        'Office Productivity' => [
            'excel', 'microsoft excel', 'microsoft office', 'word', 'powerpoint',
            'google sheets', 'office productivity', 'vba',
        ],
        'Marketing' => [
            'digital marketing', 'seo', 'social media marketing', 'content marketing',
            'email marketing', 'google ads', 'facebook ads', 'copywriting', 'branding',
        ],
        'Business' => [
            'business', 'management', 'leadership', 'operations management',
            'business strategy', 'business analysis', 'communication skills',
        ],
        'Entrepreneurship' => [
            'entrepreneurship', 'startup', 'business startup', 'freelancing',
            'online business', 'business plan',
        ],
        'Project Management' => [
            'project management', 'agile', 'scrum', 'pmp', 'product management',
            'jira', 'risk management',
        ],
        'Sales' => [
            'sales', 'sales management', 'b2b sales', 'lead generation', 'cold email',
            'customer success', 'crm',
        ],
        'Human Resources' => [
            'human resources', 'hr management', 'recruitment', 'talent acquisition',
            'employee management', 'performance management',
        ],
        'Design' => [
            'graphic design', 'ui ux', 'figma', 'photoshop', 'illustrator', 'canva',
            'web design', 'user experience', 'user interface',
        ],
        'Photography & Video' => [
            'photography', 'video editing', 'premiere pro', 'after effects',
            'davinci resolve', 'cinematography', 'youtube',
        ],
        'Finance & Accounting' => [
            'finance', 'accounting', 'financial analysis', 'bookkeeping', 'investing',
            'stock market', 'financial modeling', 'quickbooks',
        ],
        'E-Commerce' => [
            'ecommerce', 'e commerce', 'shopify', 'woocommerce', 'amazon fba',
            'dropshipping', 'etsy',
        ],
        'Personal Development' => [
            'personal development', 'productivity', 'time management', 'confidence',
            'goal setting', 'mindfulness', 'public speaking',
        ],
        'Career' => [
            'career', 'interview', 'resume', 'cv', 'job search', 'linkedin',
            'career development', 'freelance career',
        ],
        'Teaching & Academics' => [
            'teaching', 'education', 'teacher training', 'instructional design',
            'academic writing', 'research methods',
        ],
        'Languages' => [
            'english language', 'spoken english', 'business english', 'spanish language',
            'german language', 'french language', 'arabic language', 'ielts',
        ],
        'Engineering' => [
            'engineering', 'mechanical engineering', 'civil engineering',
            'electrical engineering', 'chemical engineering', 'autocad', 'solidworks',
        ],
        'Electronics' => [
            'electronics', 'arduino', 'raspberry pi', 'embedded systems', 'pcb design',
            'iot', 'robotics',
        ],
        'Mathematics' => [
            'mathematics', 'calculus', 'algebra', 'linear algebra', 'probability',
            'mathematical statistics',
        ],
        'Science' => [
            'physics', 'chemistry', 'environmental science', 'astronomy',
            'scientific research',
        ],
    ];

    private const CATEGORY_ICONS = [
        'Biomedical' => '🧬',
        'Development' => '💻',
        'Artificial Intelligence' => '🤖',
        'Data Science & Analytics' => '📊',
        'Cyber Security' => '🔐',
        'Cloud & DevOps' => '☁️',
        'IT & Software' => '🖥️',
        'Mobile Development' => '📱',
        'Database' => '🗄️',
        'Office Productivity' => '📈',
        'Marketing' => '📣',
        'Business' => '💼',
        'Entrepreneurship' => '🚀',
        'Project Management' => '📋',
        'Sales' => '🤝',
        'Human Resources' => '👥',
        'Design' => '🎨',
        'Photography & Video' => '🎬',
        'Finance & Accounting' => '💰',
        'E-Commerce' => '🛒',
        'Personal Development' => '🌱',
        'Career' => '🎯',
        'Teaching & Academics' => '🎓',
        'Languages' => '🌐',
        'Engineering' => '⚙️',
        'Electronics' => '🔌',
        'Mathematics' => '➗',
        'Science' => '🔬',
    ];

    private const GENERIC_ANCHOR_TEXT = [
        'free', 'english', 'spanish', 'german', 'arabic', 'french', 'italian',
        'business', 'marketing', 'academic', 'software', 'certification',
        'next', 'previous', 'more', 'view', 'get course', 'coupon',
    ];

    public function import(
        int $limitPerCategory = 20,
        array $requestedCategories = [],
        int $pagesPerQuery = 1,
        bool $dryRun = false,
        ?callable $progress = null
    ): array {
        $limitPerCategory = max(1, min(100, $limitPerCategory));
        $pagesPerQuery = max(1, min(8, $pagesPerQuery));

        $categories = $this->selectedCategories($requestedCategories);
        $result = [
            'limit_per_category' => $limitPerCategory,
            'dry_run' => $dryRun,
            'categories' => [],
            'total_saved' => 0,
            'total_created' => 0,
            'total_updated' => 0,
            'total_skipped' => 0,
        ];

        // Global across the whole run so one Udemy course cannot be moved through
        // multiple categories just because several search keywords matched it.
        $claimedUdemySlugs = [];

        foreach (array_keys($categories) as $position => $category) {
            if (! $dryRun) {
                $this->ensureCategory($category, $position);
            }

            $stats = [
                'category' => $category,
                'saved' => 0,
                'created' => 0,
                'updated' => 0,
                'skipped' => 0,
                'candidates' => 0,
                'errors' => [],
            ];

            $progress && $progress($category, 'Searching current paid Udemy courses with 100% off coupons...');

            $seenDetailUrls = [];

            foreach ($categories[$category] as $query) {
                if ($stats['saved'] >= $limitPerCategory) {
                    break;
                }

                for ($page = 1; $page <= $pagesPerQuery; $page++) {
                    if ($stats['saved'] >= $limitPerCategory) {
                        break 2;
                    }

                    $searchUrl = self::SOURCE_BASE.'/search/'.$page.'/'.rawurlencode($query).'.jsf';
                    $pageData = $this->getPage($searchUrl);

                    if (! $pageData) {
                        $stats['errors'][] = "Could not load {$query} page {$page}.";
                        continue;
                    }

                    $candidates = $this->extractCandidates($pageData['body'], $pageData['url']);
                    $stats['candidates'] += count($candidates);

                    foreach ($candidates as $candidate) {
                        if ($stats['saved'] >= $limitPerCategory) {
                            break;
                        }

                        $detailKey = strtolower($candidate['detail_url']);
                        if (isset($seenDetailUrls[$detailKey])) {
                            continue;
                        }
                        $seenDetailUrls[$detailKey] = true;

                        $resolved = $this->resolveUdemyCoupon($candidate['detail_url']);
                        if (! $resolved) {
                            $stats['skipped']++;
                            continue;
                        }

                        $udemySlug = $this->udemySlug($resolved['url']);
                        if (! $udemySlug || isset($claimedUdemySlugs[$udemySlug])) {
                            continue;
                        }
                        $claimedUdemySlugs[$udemySlug] = true;

                        $candidate['category'] = $category;
                        $candidate['search_query'] = $query;
                        $candidate['udemy_url'] = $resolved['url'];
                        $candidate['coupon_code'] = $resolved['coupon_code'];
                        $candidate['udemy_slug'] = $udemySlug;

                        if ($dryRun) {
                            $stats['saved']++;
                            $stats['created']++;
                            $progress && $progress($category, "Verified 100% OFF: {$candidate['title']}");
                            continue;
                        }

                        $save = $this->saveCourse($candidate);
                        if ($save === null) {
                            $stats['skipped']++;
                            continue;
                        }

                        $stats['saved']++;
                        $stats[$save]++;
                        $progress && $progress($category, ucfirst($save).": {$candidate['title']}");
                    }
                }
            }

            $result['categories'][] = $stats;
            $result['total_saved'] += $stats['saved'];
            $result['total_created'] += $stats['created'];
            $result['total_updated'] += $stats['updated'];
            $result['total_skipped'] += $stats['skipped'];

            $progress && $progress(
                $category,
                "Done: {$stats['saved']}/{$limitPerCategory} verified paid-to-free coupon course(s) saved."
            );
        }

        return $result;
    }

    public function availableCategories(): array
    {
        return array_keys(self::CATEGORY_QUERIES);
    }

    private function selectedCategories(array $requested): array
    {
        if ($requested === []) {
            return self::CATEGORY_QUERIES;
        }

        $lookup = [];
        foreach (self::CATEGORY_QUERIES as $name => $queries) {
            $lookup[strtolower($name)] = [$name, $queries];
        }

        $selected = [];
        foreach ($requested as $name) {
            $key = strtolower(trim((string) $name));
            if (! isset($lookup[$key])) {
                continue;
            }

            [$canonical, $queries] = $lookup[$key];
            $selected[$canonical] = $queries;
        }

        return $selected ?: self::CATEGORY_QUERIES;
    }

    private function getPage(string $url): ?array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (compatible; BestWayAcademyCouponImporter/2.0)',
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language' => 'en-US,en;q=0.9',
            ])
                ->withOptions(['allow_redirects' => true])
                ->timeout(20)
                ->retry(2, 500, throw: false)
                ->get($url);

            if (! $response->successful()) {
                return null;
            }

            $stats = $response->handlerStats();
            $effectiveUrl = (string) ($stats['url'] ?? $url);

            return ['body' => $response->body(), 'url' => $effectiveUrl];
        } catch (Throwable) {
            return null;
        }
    }

    private function extractCandidates(string $html, string $pageUrl): array
    {
        $doc = $this->document($html);
        if (! $doc) {
            return [];
        }

        $xpath = new DOMXPath($doc);
        $found = [];

        foreach ($xpath->query('//a[@href]') ?: [] as $anchor) {
            if (! $anchor instanceof DOMElement) {
                continue;
            }

            $title = $this->cleanText($anchor->textContent);
            if (! $this->looksLikeCourseTitle($title)) {
                $title = trim((string) $anchor->getAttribute('title'));
            }
            if (! $this->looksLikeCourseTitle($title)) {
                $img = $xpath->query('.//img[@alt]', $anchor)?->item(0);
                $title = $img instanceof DOMElement ? $this->cleanText($img->getAttribute('alt')) : '';
            }
            if (! $this->looksLikeCourseTitle($title)) {
                continue;
            }

            $detailUrl = $this->absoluteSourceUrl($anchor->getAttribute('href'), $pageUrl);
            if (! $detailUrl || ! $this->looksLikeDetailUrl($detailUrl)) {
                continue;
            }

            $container = $this->paidToFreeContainer($anchor);
            if (! $container) {
                continue;
            }

            $containerText = $this->cleanText($container->textContent);
            if (! preg_match($this->paidToFreePattern(), $containerText, $priceMatch)) {
                continue;
            }

            $originalPrice = $priceMatch['original'] ?? null;
            if (! $this->hasPositiveOriginalPrice($originalPrice)) {
                continue;
            }

            $key = strtolower($detailUrl);
            if (isset($found[$key])) {
                continue;
            }

            $found[$key] = [
                'title' => mb_substr($title, 0, 255),
                'subtitle' => $this->extractSubtitle($xpath, $container, $title),
                'image' => $this->extractImage($xpath, $container, $pageUrl),
                'original_price_label' => $originalPrice,
                'detail_url' => $detailUrl,
                'source' => 'couponami',
            ];
        }

        return array_values($found);
    }

    private function paidToFreeContainer(DOMElement $anchor): ?DOMElement
    {
        $node = $anchor;

        for ($i = 0; $i < 8; $i++) {
            $parent = $node->parentNode;
            if (! $parent instanceof DOMElement) {
                break;
            }

            $text = $this->cleanText($parent->textContent);
            if (preg_match($this->paidToFreePattern(), $text, $match)
                && $this->hasPositiveOriginalPrice($match['original'] ?? null)) {
                return $parent;
            }

            if (mb_strlen($text) > 5000) {
                break;
            }

            $node = $parent;
        }

        return null;
    }

    private function paidToFreePattern(): string
    {
        return '/(?P<original>(?:US\$|\$|€|£|₹|Rs\.?)\s*\d+(?:[.,]\d+)?)\s*'
            .'(?:->|→|–>|—>)\s*(?:US\$|\$|€|£|₹|Rs\.?)?\s*0(?:[.,]0{1,2})?\b/iu';
    }

    private function hasPositiveOriginalPrice(?string $label): bool
    {
        if (! is_string($label) || $label === '') {
            return false;
        }

        $number = preg_replace('/[^0-9.,]/u', '', $label);
        if (! is_string($number) || $number === '') {
            return false;
        }

        $number = str_replace(',', '.', $number);
        return (float) $number > 0;
    }

    private function extractSubtitle(DOMXPath $xpath, DOMElement $container, string $title): string
    {
        foreach ($xpath->query('.//p|.//*[contains(@class,"description")]|.//*[contains(@class,"subtitle")]', $container) ?: [] as $node) {
            $text = $this->cleanText($node->textContent);
            if (
                mb_strlen($text) >= 20
                && mb_strlen($text) <= 1200
                && strcasecmp($text, $title) !== 0
                && ! preg_match($this->paidToFreePattern(), $text)
            ) {
                return mb_substr($text, 0, 1000);
            }
        }

        return 'Limited-time Udemy course coupon verified from a current paid-to-free offer.';
    }

    private function extractImage(DOMXPath $xpath, DOMElement $container, string $pageUrl): ?string
    {
        foreach ($xpath->query('.//img', $container) ?: [] as $img) {
            if (! $img instanceof DOMElement) {
                continue;
            }

            foreach (['data-src', 'data-lazy-src', 'src'] as $attribute) {
                $value = trim((string) $img->getAttribute($attribute));
                if ($value === '') {
                    continue;
                }

                $url = $this->absoluteUrl($value, $pageUrl);
                if ($url && preg_match('#^https?://#i', $url)) {
                    return mb_substr($url, 0, 2000);
                }
            }
        }

        return null;
    }

    private function resolveUdemyCoupon(string $detailUrl): ?array
    {
        $detail = $this->getPage($detailUrl);
        if (! $detail || $this->looksExpired($detail['body'])) {
            return null;
        }

        if ($coupon = $this->validatedUdemyCouponUrl($detail['url'])) {
            return $coupon;
        }

        if ($coupon = $this->findUdemyCouponInHtml($detail['body'])) {
            return $coupon;
        }

        $doc = $this->document($detail['body']);
        $goUrls = [];

        if ($doc) {
            $xpath = new DOMXPath($doc);
            foreach ($xpath->query('//a[@href]') ?: [] as $anchor) {
                if (! $anchor instanceof DOMElement) {
                    continue;
                }

                $href = html_entity_decode(trim($anchor->getAttribute('href')), ENT_QUOTES | ENT_HTML5);
                $absolute = $this->absoluteUrl($href, $detail['url']);
                if (! $absolute) {
                    continue;
                }

                if ($coupon = $this->validatedUdemyCouponUrl($absolute)) {
                    return $coupon;
                }

                $parts = parse_url($absolute);
                $host = strtolower((string) ($parts['host'] ?? ''));
                $path = (string) ($parts['path'] ?? '');
                if ($this->isSourceHost($host) && str_starts_with($path, '/go/')) {
                    $goUrls[] = $absolute;
                }
            }
        }

        $path = (string) (parse_url($detailUrl, PHP_URL_PATH) ?? '');
        $detailSlug = basename(rtrim($path, '/'));
        if ($detailSlug !== '' && $detailSlug !== '.') {
            $goUrls[] = self::SOURCE_BASE.'/go/'.rawurlencode($detailSlug);
        }

        foreach (array_values(array_unique($goUrls)) as $goUrl) {
            $go = $this->getPage($goUrl);
            if (! $go || $this->looksExpired($go['body'])) {
                continue;
            }

            if ($coupon = $this->validatedUdemyCouponUrl($go['url'])) {
                return $coupon;
            }

            if ($coupon = $this->findUdemyCouponInHtml($go['body'])) {
                return $coupon;
            }
        }

        return null;
    }

    private function looksExpired(string $html): bool
    {
        $text = strtolower($this->cleanText(strip_tags($html)));

        return (bool) preg_match(
            '/\b(expired coupon|coupon expired|coupon has expired|offer expired|deal expired|promotion expired)\b/i',
            $text
        );
    }

    private function findUdemyCouponInHtml(string $html): ?array
    {
        $decoded = html_entity_decode($html, ENT_QUOTES | ENT_HTML5);

        if (preg_match_all('~https?://(?:[a-z0-9-]+\.)?udemy\.com/course/[^\s"\'<>]+~iu', $decoded, $matches)) {
            foreach ($matches[0] as $url) {
                $url = rtrim($url, ".,);]");
                if ($coupon = $this->validatedUdemyCouponUrl($url)) {
                    return $coupon;
                }
            }
        }

        return null;
    }

    private function validatedUdemyCouponUrl(string $url): ?array
    {
        $url = html_entity_decode(trim($url), ENT_QUOTES | ENT_HTML5);
        if ($url === '') {
            return null;
        }

        $parts = parse_url($url);
        if (! is_array($parts)) {
            return null;
        }

        $host = strtolower((string) ($parts['host'] ?? ''));
        $path = (string) ($parts['path'] ?? '');
        if (! ($host === 'udemy.com' || str_ends_with($host, '.udemy.com')) || ! str_starts_with($path, '/course/')) {
            return null;
        }

        parse_str((string) ($parts['query'] ?? ''), $query);
        $couponCode = null;
        foreach ($query as $key => $value) {
            if (strtolower((string) $key) === 'couponcode' && is_scalar($value)) {
                $couponCode = trim((string) $value);
                break;
            }
        }

        if (! $couponCode || mb_strlen($couponCode) > 160) {
            return null;
        }

        if (($parts['scheme'] ?? '') !== 'https') {
            $url = preg_replace('#^http://#i', 'https://', $url) ?: $url;
        }

        return [
            'url' => mb_substr($url, 0, 2048),
            'coupon_code' => $couponCode,
        ];
    }

    private function saveCourse(array $course): ?string
    {
        $slug = $this->localSlug($course['udemy_slug']);
        $existing = DB::table('courses')->where('slug', $slug)->first();

        if ($existing) {
            $existingMeta = $this->decodeMetadata($existing->metadata ?? null);
            if (($existingMeta['external_provider'] ?? null) !== 'udemy') {
                $slug = mb_substr($slug.'-'.substr(sha1($course['udemy_slug']), 0, 8), 0, 120);
                $existing = DB::table('courses')->where('slug', $slug)->first();
            }
        }

        $metadata = [
            'external_provider' => 'udemy',
            'external_offer' => '100_percent_coupon',
            'verified_paid_to_free' => true,
            'source' => $course['source'],
            'source_url' => $course['detail_url'],
            'coupon_code' => $course['coupon_code'],
            'original_price_label' => $course['original_price_label'],
            'search_query' => $course['search_query'],
            'imported_at' => now()->toIso8601String(),
            'learn' => [
                'Use the Udemy coupon link while the limited-time 100% off offer remains active.',
                'Enrollment and course access are completed directly on Udemy.',
            ],
            'modules' => [],
        ];

        $now = now();
        $row = [
            'instructor_id' => $existing->instructor_id ?? $this->adminId(),
            'slug' => $slug,
            'title' => trim($course['title']),
            'category' => $course['category'],
            'subtitle' => $course['subtitle'],
            'description' => $course['subtitle'],
            'price' => 0,
            'status' => 'published',
            'rating' => $existing->rating ?? 0,
            'students_count' => $existing->students_count ?? 0,
            'image' => $course['image'],
            'badge' => 'Udemy 100% OFF',
            'metadata' => json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'updated_at' => $now,
        ];

        if (Schema::hasColumn('courses', 'course_link')) {
            $row['course_link'] = $course['udemy_url'];
        }
        if (Schema::hasColumn('courses', 'is_free')) {
            // It is free only after the external coupon is applied, therefore it
            // must not enter the academy's own local free-enrollment flow.
            $row['is_free'] = false;
        }

        $action = $existing ? 'updated' : 'created';

        DB::transaction(function () use ($existing, $row, $course, $now): void {
            if ($existing) {
                DB::table('courses')->where('id', $existing->id)->update($row);
                $courseId = (int) $existing->id;
            } else {
                $insert = $row;
                $insert['created_at'] = $now;
                $courseId = (int) DB::table('courses')->insertGetId($insert);
            }

            $this->persistCourseLink($courseId, $course['udemy_url']);
        });

        return $action;
    }

    private function persistCourseLink(int $courseId, string $url): void
    {
        if (Schema::hasTable('course_access_links')) {
            $exists = DB::table('course_access_links')->where('course_id', $courseId)->exists();
            if ($exists) {
                DB::table('course_access_links')->where('course_id', $courseId)->update([
                    'url' => $url,
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('course_access_links')->insert([
                    'course_id' => $courseId,
                    'url' => $url,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        if (Schema::hasTable('platform_settings')) {
            $key = 'course_link_'.$courseId;
            $value = json_encode($url, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $exists = DB::table('platform_settings')->where('key', $key)->exists();

            if ($exists) {
                DB::table('platform_settings')->where('key', $key)->update([
                    'value' => $value,
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('platform_settings')->insert([
                    'key' => $key,
                    'value' => $value,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    private function ensureCategory(string $name, int $position): void
    {
        if (! Schema::hasTable('course_categories')) {
            return;
        }

        $existing = DB::table('course_categories')->where('name', $name)->first();
        if ($existing) {
            $update = ['active' => true, 'updated_at' => now()];
            if ($name === 'Biomedical') {
                $update['position'] = 0;
            }
            if (empty($existing->icon) && isset(self::CATEGORY_ICONS[$name])) {
                $update['icon'] = self::CATEGORY_ICONS[$name];
            }

            DB::table('course_categories')->where('id', $existing->id)->update($update);
            return;
        }

        $slugBase = Str::slug($name) ?: 'category';
        $slug = $slugBase;
        $suffix = 2;
        while (DB::table('course_categories')->where('slug', $slug)->exists()) {
            $slug = $slugBase.'-'.$suffix++;
        }

        $maxPosition = (int) DB::table('course_categories')->max('position');
        DB::table('course_categories')->insert([
            'name' => $name,
            'slug' => $slug,
            'description' => $name === 'Biomedical'
                ? 'Current biomedical and healthcare Udemy courses available through verified limited-time 100% off coupons.'
                : 'Current paid Udemy courses available through verified limited-time 100% off coupons.',
            'icon' => self::CATEGORY_ICONS[$name] ?? null,
            'active' => true,
            'position' => $name === 'Biomedical' ? 0 : max($maxPosition + 1, $position + 1),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function adminId(): ?int
    {
        $id = DB::table('users')->where('role', 'admin')->orderBy('id')->value('id');
        return $id !== null ? (int) $id : null;
    }

    private function localSlug(string $udemySlug): string
    {
        $slug = 'udemy-'.(Str::slug($udemySlug) ?: substr(sha1($udemySlug), 0, 24));
        return mb_substr($slug, 0, 120);
    }

    private function udemySlug(string $url): ?string
    {
        $path = trim((string) (parse_url($url, PHP_URL_PATH) ?? ''), '/');
        if (! str_starts_with($path, 'course/')) {
            return null;
        }

        $slug = trim(substr($path, strlen('course/')), '/');
        return $slug !== '' ? $slug : null;
    }

    private function decodeMetadata(mixed $metadata): array
    {
        if (is_array($metadata)) {
            return $metadata;
        }
        if (! is_string($metadata) || $metadata === '') {
            return [];
        }

        $decoded = json_decode($metadata, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function document(string $html): ?DOMDocument
    {
        if ($html === '') {
            return null;
        }

        $doc = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $loaded = $doc->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_NOWARNING | LIBXML_NOERROR);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        return $loaded ? $doc : null;
    }

    private function looksLikeCourseTitle(string $title): bool
    {
        $title = $this->cleanText($title);
        if (mb_strlen($title) < 8 || mb_strlen($title) > 255) {
            return false;
        }

        if (in_array(strtolower($title), self::GENERIC_ANCHOR_TEXT, true)) {
            return false;
        }

        return ! preg_match('/^\d+$/', $title);
    }

    private function looksLikeDetailUrl(string $url): bool
    {
        $parts = parse_url($url);
        if (! is_array($parts) || ! $this->isSourceHost(strtolower((string) ($parts['host'] ?? '')))) {
            return false;
        }

        $segments = array_values(array_filter(explode('/', trim((string) ($parts['path'] ?? ''), '/'))));
        if (count($segments) < 2) {
            return false;
        }

        return ! in_array(strtolower($segments[0]), [
            'all', 'search', 'category', 'language', 'go', 'review', 'privacy-policy',
            'terms', 'disclaimer', 'dmca', 'contact',
        ], true);
    }

    private function isSourceHost(string $host): bool
    {
        return $host === 'couponami.com' || $host === 'www.couponami.com'
            || $host === 'discudemy.com' || $host === 'www.discudemy.com';
    }

    private function absoluteSourceUrl(string $href, string $base): ?string
    {
        $url = $this->absoluteUrl($href, $base);
        if (! $url) {
            return null;
        }

        $host = strtolower((string) (parse_url($url, PHP_URL_HOST) ?? ''));
        return $this->isSourceHost($host) ? $url : null;
    }

    private function absoluteUrl(string $href, string $base): ?string
    {
        $href = html_entity_decode(trim($href), ENT_QUOTES | ENT_HTML5);
        if ($href === '' || str_starts_with($href, '#') || preg_match('/^(javascript|data|mailto|tel):/i', $href)) {
            return null;
        }

        if (preg_match('#^https?://#i', $href)) {
            return $href;
        }

        $baseParts = parse_url($base);
        if (! is_array($baseParts) || empty($baseParts['host'])) {
            return null;
        }

        $scheme = $baseParts['scheme'] ?? 'https';
        $origin = $scheme.'://'.$baseParts['host'];

        if (str_starts_with($href, '//')) {
            return $scheme.':'.$href;
        }

        if (str_starts_with($href, '/')) {
            return $origin.$href;
        }

        $dir = isset($baseParts['path']) ? rtrim(dirname($baseParts['path']), '/') : '';
        return $origin.($dir ? '/'.ltrim($dir, '/') : '').'/'.$href;
    }

    private function cleanText(?string $value): string
    {
        $value = html_entity_decode((string) $value, ENT_QUOTES | ENT_HTML5);
        return trim((string) preg_replace('/\s+/u', ' ', $value));
    }
}
