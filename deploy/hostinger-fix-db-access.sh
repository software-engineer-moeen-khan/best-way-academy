#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_BASE="https://developers.hostinger.com"

log(){ printf '\033[1;36m[BWA]\033[0m %s\n' "$*"; }
fail(){ printf '\033[1;31m[BWA ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

cd "$ROOT"
[[ -f .env ]] || fail ".env was not found. Run this from the deployed project after at least one deploy attempt."
[[ -f deploy/env-set.php ]] || fail "deploy/env-set.php is missing."

PHP_BIN=""
for c in php php84 php83 php82; do
  if command -v "$c" >/dev/null 2>&1; then
    if "$c" -r 'exit(version_compare(PHP_VERSION,"8.2.0",">=")?0:1);' >/dev/null 2>&1; then
      PHP_BIN="$(command -v "$c")"
      break
    fi
  fi
done
[[ -n "$PHP_BIN" ]] || fail "PHP 8.2+ CLI is required."
command -v curl >/dev/null 2>&1 || fail "curl is required."

HOSTINGER_USERNAME="${HOSTINGER_USERNAME:-}"
HOSTINGER_DOMAIN="${HOSTINGER_DOMAIN:-}"
if [[ -z "$HOSTINGER_USERNAME" && "$ROOT" =~ /home/(u[0-9]+)/ ]]; then HOSTINGER_USERNAME="${BASH_REMATCH[1]}"; fi
if [[ -z "$HOSTINGER_DOMAIN" && "$ROOT" =~ /domains/([^/]+) ]]; then HOSTINGER_DOMAIN="${BASH_REMATCH[1]}"; fi
if [[ -z "$HOSTINGER_DOMAIN" ]]; then
  guess="$(basename "$ROOT")"
  [[ "$guess" == *.* ]] && HOSTINGER_DOMAIN="$guess" || true
fi
[[ -n "$HOSTINGER_DOMAIN" ]] || read -rp "Domain: " HOSTINGER_DOMAIN
[[ -n "$HOSTINGER_USERNAME" ]] || read -rp "Hostinger account username (u123456789): " HOSTINGER_USERNAME

setenv(){ "$PHP_BIN" deploy/env-set.php .env "$1" "$2"; }
envget(){ "$PHP_BIN" -r '$e=parse_ini_file($argv[1]);echo $e[$argv[2]]??"";' .env "$1" 2>/dev/null || true; }

DB_DATABASE="$(envget DB_DATABASE)"
DB_USERNAME="$(envget DB_USERNAME)"

HOSTINGER_API_TOKEN="${HOSTINGER_API_TOKEN:-}"
if [[ -z "$HOSTINGER_API_TOKEN" ]]; then
  printf 'Hostinger API token (input hidden; used only to reset this database password): '
  read -rs HOSTINGER_API_TOKEN
  printf '\n'
fi
[[ -n "$HOSTINGER_API_TOKEN" ]] || fail "Hostinger API token is required for database password recovery."

log "Resolving the existing Hostinger database..."
EXISTING="$(curl -fsS "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/databases?domain=$HOSTINGER_DOMAIN&per_page=100" \
  -H "Authorization: Bearer $HOSTINGER_API_TOKEN")" || fail "Could not list Hostinger databases. Check the API token and account."

if [[ -z "$DB_DATABASE" ]]; then
  DB_DATABASE="$(printf '%s' "$EXISTING" | D="$HOSTINGER_DOMAIN" "$PHP_BIN" -r '$j=json_decode(stream_get_contents(STDIN),true);$rows=$j["data"]??$j;if(!is_array($rows))$rows=[];foreach($rows as $d){$n=$d["name"]??"";if(($d["domain"]??"")===getenv("D") && str_ends_with($n,"_bwa_academy")){echo $n;break;}}')"
fi
[[ -n "$DB_DATABASE" ]] || fail "Could not find the Best Way Academy database for $HOSTINGER_DOMAIN."

RESOLVED_USER="$(printf '%s' "$EXISTING" | N="$DB_DATABASE" "$PHP_BIN" -r '$j=json_decode(stream_get_contents(STDIN),true);$rows=$j["data"]??$j;if(!is_array($rows))$rows=[];foreach($rows as $d){if(($d["name"]??"")===getenv("N")){echo $d["user"]??"";break;}}')"
[[ -n "$RESOLVED_USER" ]] || fail "Database $DB_DATABASE was not returned by Hostinger for this account/domain."
DB_USERNAME="$RESOLVED_USER"

NEW_DB_PASSWORD="$($PHP_BIN -r 'echo rtrim(strtr(base64_encode(random_bytes(27)),"+/","AZ"),"=")."aA9!";')"
BODY="$($PHP_BIN -r 'echo json_encode(["password"=>$argv[1]],JSON_UNESCAPED_SLASHES);' "$NEW_DB_PASSWORD")"

log "Resetting password for the existing database user through Hostinger API..."
curl -fsS -X PATCH "$API_BASE/api/hosting/v1/accounts/$HOSTINGER_USERNAME/databases/$DB_DATABASE/change-password" \
  -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  --data "$BODY" >/dev/null || fail "Hostinger rejected the database password reset request."

setenv DB_CONNECTION mysql
setenv DB_HOST localhost
setenv DB_PORT 3306
setenv DB_DATABASE "$DB_DATABASE"
setenv DB_USERNAME "$DB_USERNAME"
setenv DB_PASSWORD "$NEW_DB_PASSWORD"
chmod 600 .env || true

log "Waiting for the new MySQL credentials to become active..."
CONNECTED=0
for attempt in {1..12}; do
  if "$PHP_BIN" -r '$dsn="mysql:host=localhost;port=3306;dbname=".$argv[1].";charset=utf8mb4";try{$pdo=new PDO($dsn,$argv[2],$argv[3],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$pdo->query("SELECT 1");exit(0);}catch(Throwable $e){exit(1);}' "$DB_DATABASE" "$DB_USERNAME" "$NEW_DB_PASSWORD" >/dev/null 2>&1; then
    CONNECTED=1
    break
  fi
  sleep 2
done

unset BODY NEW_DB_PASSWORD HOSTINGER_API_TOKEN
[[ "$CONNECTED" -eq 1 ]] || fail "Password was reset but MySQL did not accept the new credentials yet. Wait one minute and run this helper again."

"$PHP_BIN" artisan optimize:clear >/dev/null 2>&1 || true
log "MySQL connection verified successfully. Existing database/data were preserved."
log "Now run: ./deploy/hostinger-deploy.sh"
