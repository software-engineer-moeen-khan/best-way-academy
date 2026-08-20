<?php

use App\Services\UdemyCouponImporter;
use App\Services\UdemyEnglishCourseCleaner;
use Illuminate\Support\Facades\Artisan;

Artisan::command(
    'courses:import-udemy-coupons
        {--limit=20 : Maximum verified paid-to-free Udemy courses to save per category}
        {--category=* : Import only one or more named categories}
        {--pages=1 : Search pages to scan for each keyword (1-8)}
        {--dry-run : Discover and verify coupons without writing to the database}',
    function (UdemyCouponImporter $importer, UdemyEnglishCourseCleaner $englishCleaner): int {
        $limit = max(1, min(100, (int) $this->option('limit')));
        $pages = max(1, min(8, (int) $this->option('pages')));
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

        $this->info(($dryRun ? 'Checking' : 'Importing').' verified English Udemy paid courses with 100% off coupons.');
        $this->line('Biomedical is processed first when all categories are imported.');
        $this->line('Expired offers, non-Udemy links, missing coupon codes and non-100%-off listings are skipped.');
        $this->line('After import, non-English Udemy coupon courses are removed automatically.');
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
            ['Category', 'Verified saved', 'Created', 'Updated', 'Skipped', 'Source errors'],
            $rows
        );

        $this->info(
            "Finished. Saved {$result['total_saved']} verified 100%-off coupon course(s) "
            ."({$result['total_created']} created, {$result['total_updated']} updated)."
        );

        if (! $dryRun) {
            $this->newLine();
            $this->info('Applying English-only catalog policy...');
            $cleanup = $englishCleaner->cleanup(function (string $message): void {
                $this->line('<comment>[Language]</comment> '.$message);
            });

            $this->line(
                "Language cleanup checked {$cleanup['checked']} Udemy coupon course(s): "
                ."{$cleanup['english']} English kept, {$cleanup['removed']} non-English removed, "
                ."{$cleanup['archived']} archived because of order history, {$cleanup['unknown']} could not be classified."
            );
            $this->line('Imported courses open the verified Udemy coupon URL instead of the local checkout flow.');
        }

        return 0;
    }
)->purpose('Import paid Udemy courses with verified 100% off coupons and keep only English-language courses.');

Artisan::command(
    'courses:cleanup-udemy-language',
    function (UdemyEnglishCourseCleaner $englishCleaner): int {
        $this->info('Removing non-English Udemy coupon courses...');

        $cleanup = $englishCleaner->cleanup(function (string $message): void {
            $this->line('<comment>[Language]</comment> '.$message);
        });

        $this->newLine();
        $this->table(
            ['Checked', 'English kept', 'Removed', 'Archived', 'Unknown'],
            [[
                $cleanup['checked'],
                $cleanup['english'],
                $cleanup['removed'],
                $cleanup['archived'],
                $cleanup['unknown'],
            ]]
        );

        $this->info('English-only Udemy coupon cleanup finished.');

        return 0;
    }
)->purpose('Remove imported Udemy coupon courses whose source language is not English.');
