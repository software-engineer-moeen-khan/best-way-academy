<?php

use App\Services\UdemyCouponImporter;
use Illuminate\Support\Facades\Artisan;

Artisan::command(
    'courses:import-udemy-coupons
        {--limit=10 : Maximum valid coupon courses to save per category}
        {--category=* : Import only one or more named categories}
        {--pages=1 : Search pages to scan for each keyword (1-5)}
        {--dry-run : Discover and verify coupons without writing to the database}',
    function (UdemyCouponImporter $importer): int {
        $limit = max(1, min(50, (int) $this->option('limit')));
        $pages = max(1, min(5, (int) $this->option('pages')));
        $categories = array_values(array_filter(array_map(
            static fn ($value) => trim((string) $value),
            (array) $this->option('category')
        )));
        $dryRun = (bool) $this->option('dry-run');

        if ($categories) {
            $valid = array_map('strtolower', $importer->availableCategories());
            $unknown = array_values(array_filter(
                $categories,
                static fn ($name) => ! in_array(strtolower($name), $valid, true)
            ));

            if ($unknown) {
                $this->error('Unknown category: '.implode(', ', $unknown));
                $this->line('Available: '.implode(', ', $importer->availableCategories()));
                return 2;
            }
        }

        $this->info(($dryRun ? 'Checking' : 'Importing').' current Udemy 100% off coupon courses.');
        $this->line('Biomedical is processed first when all categories are imported.');
        $this->newLine();

        $result = $importer->import(
            limitPerCategory: $limit,
            requestedCategories: $categories,
            pagesPerQuery: $pages,
            dryRun: $dryRun,
            progress: function (string $category, string $message): void {
                $this->line("<comment>[{$category}]</comment> {$message}");
            },
        );

        $rows = array_map(static fn (array $stats) => [
            $stats['category'],
            $stats['saved'].'/'.$limit,
            $stats['created'],
            $stats['updated'],
            $stats['skipped'],
            count($stats['errors']),
        ], $result['categories']);

        $this->newLine();
        $this->table(
            ['Category', 'Valid saved', 'Created', 'Updated', 'Skipped', 'Source errors'],
            $rows
        );

        $this->info(
            "Finished. Saved {$result['total_saved']} valid coupon course(s) "
            ."({$result['total_created']} created, {$result['total_updated']} updated)."
        );

        if (! $dryRun) {
            $this->line('Imported courses open the verified Udemy coupon URL instead of the local checkout flow.');
        }

        return 0;
    }
)->purpose('Import current paid Udemy courses that become free with valid coupon codes.');
