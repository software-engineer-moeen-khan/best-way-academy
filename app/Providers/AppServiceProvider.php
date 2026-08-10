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

            $response->setContent($html);
        });
    }
}
