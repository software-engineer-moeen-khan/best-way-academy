#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_HTML="${PUBLIC_HTML:-$ROOT/public_html}"
API_BASE="https://developers.hostinger.com"

log(){ printf '\033[1;36m[BWA]\033[0m %s\n' "$*"; }
fail(){ printf '\033[1;31m[BWA ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

cd "$ROOT"
mkdir -p "$PUBLIC_HTML" storage/framework/{cache/data,sessions,views} storage/logs storage/app/public bootstrap/cache .deploy
chmod 700 .deploy || true

HOSTINGER_USERNAME="${HOSTINGER_USERNAME:-}"
HOSTINGER_DOMAIN="${HOSTINGER_DOMAIN:-}"
if [[ -z "$HOSTINGER_USERNAME" && "$ROOT" =~ /home/(u[0-9]+)/ ]]; then HOSTINGER_USERNAME="${BASH_REMATCH[1]}"; fi
if [[ -z "$HOSTINGER_DOMAIN" && "$ROOT" =~ /domains/([^/]+) ]]; then HOSTINGER_DOMAIN="${BASH_REMATCH[1]}"; fi
if [[ -z "$HOSTINGER_DOMAIN" ]]; then guess="$(basename "$ROOT")"; [[ "$guess" == *.* ]] && HOSTINGER_DOMAIN="$guess" || true; fi
[[ -n "$HOSTINGER_DOMAIN" ]] || read -rp "Domain (example.com): " HOSTINGER_DOMAIN
[[ -n "$HOSTINGER_USERNAME" ]] || read -rp "Hostinger account username (u123456789): " HOSTINGER_USERNAME

PHP_BIN=""
for c in php php84 php83 php82; do
  if command -v "$c" >/dev/null 2>&1; then
    if "$c" -r 'exit(version_compare(PHP_VERSION,"8.2.0",">=")?0:1);' >/dev/null 2>&1; then PHP_BIN="$(command -v "$c")"; break; fi
  fi
done
[[ -n "$PHP_BIN" ]] || fail "PHP 8.2+ CLI is required."
COMPOSER_BIN="$(command -v composer2 || command -v composer || true)"
[[ -n "$COMPOSER_BIN" ]] || fail "Composer 2 is required. Hostinger Web/Cloud normally provides composer2."
command -v curl >/dev/null 2>&1 || fail "curl is required."

log "PHP: $($PHP_BIN -r 'echo PHP_VERSION;')"
log "Installing PHP dependencies (Composer scripts disabled for Hostinger shared hosting)..."
"$COMPOSER_BIN" install --no-dev --prefer-dist --no-interaction --optimize-autoloader --no-scripts

if [[ ! -f .env ]]; then cp .env.example .env; chmod 600 .env; fi
setenv(){ "$PHP_BIN" deploy/env-set.php .env "$1" "$2"; }
setenv APP_ENV production
setenv APP_DEBUG false
setenv APP_URL "https://$HOSTINGER_DOMAIN"
setenv APP_TIMEZONE "Asia/Karachi"
setenv SESSION_SECURE_COOKIE true
setenv MAIL_FROM_ADDRESS "noreply@$HOSTINGER_DOMAIN"

# Composer normally runs this as a post-autoload script. Hostinger disables proc_open,
# so Composer cannot launch PHP subprocesses. Running Artisan directly avoids that restriction.
if "$PHP_BIN" artisan package:discover --ansi >/dev/null 2>&1; then
  log "Laravel package discovery completed directly."
else
  log "Laravel package discovery was skipped; the app can rebuild its package manifest on boot."
fi

DB_DATABASE="$($PHP_BIN -r '$e=parse_ini_file(".env");echo $e["DB_DATABASE"]??"";' 2>/dev/null || true)"
DB_USERNAME="$($PHP_BIN -r '$e=parse_ini_file(".env");echo $e["DB_USERNAME"]??"";' 2>/dev/null || true)"
DB_PASSWORD="$($PHP_BIN -r '$e=parse_ini_file(".env");echo $e["DB_PASSWORD"]??"";' 2>/dev/null || true)"
HOSTINGER_API_TOKEN="${HOSTINGER_API_TOKEN:-}"
if [[ -z "$DB_DATABASE" || -z "$DB_USERNAME" || -z "$DB_PASSWORD" ]]; then
  if [[ -z "$HOSTINGER_API_TOKEN" ]]; then
    printf 'Hostinger API token (input hidden; used only for setup): '
    read -rs HOSTINGER_API_TOKEN
    printf '\n'
  fi
  [[ -n "$HOSTINGER_API_TOKEN" ]] || fail "A Hostinger API token is required only for first-time automatic DB creation."

  log "Setting website PHP to 8.2 through Hostinger API (best effort)..."
  curl -fsS -X PATCH "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/websites/$HOSTINGER_DOMAIN/php/version" \
    -H "Authorization: Bearer $HOSTINGER_API_TOKEN" -H 'Content-Type: application/json' \
    --data '{"version":"8.2"}' >/dev/null || true

  DB_SUFFIX="bwa_academy"
  DB_USER_SUFFIX="bwa_app"
  DB_PASSWORD="$($PHP_BIN -r 'echo rtrim(strtr(base64_encode(random_bytes(24)),"+/","AZ"),"=")."aA9!";')"

  EXISTING="$(curl -fsS "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/databases?domain=$HOSTINGER_DOMAIN&per_page=100" -H "Authorization: Bearer $HOSTINGER_API_TOKEN" || true)"
  DB_DATABASE="$(printf '%s' "$EXISTING" | D="$HOSTINGER_DOMAIN" "$PHP_BIN" -r '$j=json_decode(stream_get_contents(STDIN),true);$rows=$j["data"]??$j;if(!is_array($rows))$rows=[];foreach($rows as $d){$n=$d["name"]??"";if(($d["domain"]??"")==getenv("D") && str_ends_with($n,"_bwa_academy")){echo $n;break;}}' 2>/dev/null || true)"
  DB_USERNAME="$(printf '%s' "$EXISTING" | D="$HOSTINGER_DOMAIN" "$PHP_BIN" -r '$j=json_decode(stream_get_contents(STDIN),true);$rows=$j["data"]??$j;if(!is_array($rows))$rows=[];foreach($rows as $d){$n=$d["name"]??"";if(($d["domain"]??"")==getenv("D") && str_ends_with($n,"_bwa_academy")){echo $d["user"]??"";break;}}' 2>/dev/null || true)"

  if [[ -z "$DB_DATABASE" || -z "$DB_USERNAME" ]]; then
    log "Creating MySQL database/user through Hostinger API..."
    BODY="$($PHP_BIN -r 'echo json_encode(["name"=>$argv[1],"user"=>$argv[2],"password"=>$argv[3],"website_domain"=>$argv[4]],JSON_UNESCAPED_SLASHES);' "$DB_SUFFIX" "$DB_USER_SUFFIX" "$DB_PASSWORD" "$HOSTINGER_DOMAIN")"
    curl -fsS -X POST "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/databases" \
      -H "Authorization: Bearer $HOSTINGER_API_TOKEN" -H 'Content-Type: application/json' --data "$BODY" >/dev/null
    for attempt in {1..10}; do
      sleep 2
      CREATED="$(curl -fsS "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/databases?domain=$HOSTINGER_DOMAIN&per_page=100" -H "Authorization: Bearer $HOSTINGER_API_TOKEN")"
      DB_DATABASE="$(printf '%s' "$CREATED" | D="$HOSTINGER_DOMAIN" "$PHP_BIN" -r '$j=json_decode(stream_get_contents(STDIN),true);$rows=$j["data"]??$j;if(!is_array($rows))$rows=[];foreach($rows as $d){$n=$d["name"]??"";if(($d["domain"]??"")==getenv("D") && str_ends_with($n,"_bwa_academy")){echo $n;break;}}')"
      DB_USERNAME="$(printf '%s' "$CREATED" | D="$HOSTINGER_DOMAIN" "$PHP_BIN" -r '$j=json_decode(stream_get_contents(STDIN),true);$rows=$j["data"]??$j;if(!is_array($rows))$rows=[];foreach($rows as $d){$n=$d["name"]??"";if(($d["domain"]??"")==getenv("D") && str_ends_with($n,"_bwa_academy")){echo $d["user"]??"";break;}}')"
      [[ -n "$DB_DATABASE" && -n "$DB_USERNAME" ]] && break
      log "Waiting for Hostinger database provisioning ($attempt/10)..."
    done
  else
    printf 'Existing database detected. Database password (input hidden): '
    read -rs DB_PASSWORD
    printf '\n'
  fi

  [[ -n "$DB_DATABASE" && -n "$DB_USERNAME" && -n "$DB_PASSWORD" ]] || fail "Could not resolve database credentials."
  setenv DB_CONNECTION mysql
  setenv DB_HOST localhost
  setenv DB_PORT 3306
  setenv DB_DATABASE "$DB_DATABASE"
  setenv DB_USERNAME "$DB_USERNAME"
  setenv DB_PASSWORD "$DB_PASSWORD"
fi

APP_KEY="$($PHP_BIN -r '$e=parse_ini_file(".env");echo $e["APP_KEY"]??"";' 2>/dev/null || true)"
if [[ -z "$APP_KEY" ]]; then "$PHP_BIN" artisan key:generate --force; fi
ADMIN_PASSWORD="$($PHP_BIN -r '$e=parse_ini_file(".env");echo $e["ADMIN_PASSWORD"]??"";' 2>/dev/null || true)"
if [[ -z "$ADMIN_PASSWORD" ]]; then
  ADMIN_PASSWORD="$($PHP_BIN -r 'echo rtrim(strtr(base64_encode(random_bytes(18)),"+/","XY"),"=")."aA9!";')"
  setenv ADMIN_EMAIL "admin@$HOSTINGER_DOMAIN"
  setenv ADMIN_NAME "Best Way Academy Admin"
  setenv ADMIN_PASSWORD "$ADMIN_PASSWORD"
fi
ADMIN_EMAIL="$($PHP_BIN -r '$e=parse_ini_file(".env");echo $e["ADMIN_EMAIL"]??"admin@example.com";' 2>/dev/null || true)"
if [[ ! -f .deploy/admin-credentials.txt ]]; then
  { echo "Admin URL: https://$HOSTINGER_DOMAIN/admin.html"; echo "Email: $ADMIN_EMAIL"; echo "Password: $ADMIN_PASSWORD"; } > .deploy/admin-credentials.txt
  chmod 600 .deploy/admin-credentials.txt
fi

log "Running database migrations and seeders..."
"$PHP_BIN" artisan optimize:clear
"$PHP_BIN" artisan migrate --force
"$PHP_BIN" artisan db:seed --force

log "Publishing frontend + Laravel front controller to public_html..."
PROTECTED=' checkout.html dashboard.html my-learning.html learn.html certificate.html account.html orders.html messages.html notifications.html success.html admin.html instructor.html '
find "$PUBLIC_HTML" -maxdepth 1 -type f -name '*.html' -delete
for f in "$ROOT"/*.html; do
  [[ -e "$f" ]] || continue
  name="$(basename "$f")"
  if [[ "$PROTECTED" == *" $name "* ]]; then continue; fi
  "$PHP_BIN" deploy/inject-backend.php "$f" "$PUBLIC_HTML/$name"
done
rm -rf "$PUBLIC_HTML/assets"
cp -a "$ROOT/assets" "$PUBLIC_HTML/assets"
cp "$ROOT/public/index.php" "$PUBLIC_HTML/index.php"
cp "$ROOT/public/.htaccess" "$PUBLIC_HTML/.htaccess"
rm -f "$PUBLIC_HTML/index.php~" "$PUBLIC_HTML/default.php"

chmod -R u+rwX,go+rX "$PUBLIC_HTML" || true
chmod -R ug+rwX storage bootstrap/cache || true
ln -sfn "$ROOT/storage/app/public" "$PUBLIC_HTML/storage" 2>/dev/null || true

log "Creating scheduler cron through Hostinger API (best effort)..."
if [[ -n "$HOSTINGER_API_TOKEN" ]]; then
  CRONS="$(curl -fsS "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/cron-jobs" -H "Authorization: Bearer $HOSTINGER_API_TOKEN" || true)"
  if ! printf '%s' "$CRONS" | grep -Fq "$ROOT/artisan schedule:run"; then
    CMD="$PHP_BIN $ROOT/artisan schedule:run >/dev/null 2>&1"
    BODY="$($PHP_BIN -r 'echo json_encode(["time"=>"* * * * *","command"=>$argv[1]],JSON_UNESCAPED_SLASHES);' "$CMD")"
    curl -fsS -X POST "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/cron-jobs" \
      -H "Authorization: Bearer $HOSTINGER_API_TOKEN" -H 'Content-Type: application/json' --data "$BODY" >/dev/null || true
  fi
fi

"$PHP_BIN" artisan config:cache
# route:cache/view:cache are intentionally skipped: this compatibility app serves existing HTML through small route closures and has no Blade views.

log "Deployment complete: https://$HOSTINGER_DOMAIN"
log "Backend health: https://$HOSTINGER_DOMAIN/api/health"
if [[ -f .deploy/admin-credentials.txt ]]; then
  log "Admin credentials saved server-side at: $ROOT/.deploy/admin-credentials.txt (chmod 600)"
fi
