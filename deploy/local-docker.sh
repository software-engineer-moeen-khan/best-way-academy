#!/usr/bin/env bash
set -euo pipefail
docker compose up -d --build
docker compose exec app php artisan migrate --force
docker compose exec app php artisan db:seed --force
printf 'Best Way Academy: http://localhost:8080\n'
