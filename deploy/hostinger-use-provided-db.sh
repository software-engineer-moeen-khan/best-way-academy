#!/usr/bin/env bash
# Sourced by deploy.sh. If DB_DATABASE/DB_USERNAME/DB_PASSWORD are provided in
# the shell environment, persist them to the server-only .env and verify them.
# No database password is committed to Git.

BWA_PROVIDED_DB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bwa_provided_db_log(){ printf '\033[1;36m[BWA DB]\033[0m %s\n' "$*"; }
bwa_provided_db_fail(){ printf '\033[1;31m[BWA DB ERROR]\033[0m %s\n' "$*" >&2; return 1; }

# Nothing supplied: let the normal Hostinger DB preflight handle discovery/setup.
if [[ -z "${DB_DATABASE:-}" && -z "${DB_USERNAME:-}" && -z "${DB_PASSWORD:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi

# Reject partial credentials so deployment never silently mixes shell and .env values.
if [[ -z "${DB_DATABASE:-}" || -z "${DB_USERNAME:-}" || -z "${DB_PASSWORD:-}" ]]; then
  bwa_provided_db_fail "When supplying an existing database, DB_DATABASE, DB_USERNAME and DB_PASSWORD must all be provided." || return 1
fi

cd "$BWA_PROVIDED_DB_ROOT"

BWA_PROVIDED_DB_PHP=""
for c in php php84 php83 php82; do
  if command -v "$c" >/dev/null 2>&1; then
    if "$c" -r 'exit(version_compare(PHP_VERSION,"8.2.0",">=")?0:1);' >/dev/null 2>&1; then
      BWA_PROVIDED_DB_PHP="$(command -v "$c")"
      break
    fi
  fi
done
[[ -n "$BWA_PROVIDED_DB_PHP" ]] || bwa_provided_db_fail "PHP 8.2+ CLI is required." || return 1
[[ -f deploy/env-set.php ]] || bwa_provided_db_fail "deploy/env-set.php is missing." || return 1

if [[ ! -f .env ]]; then
  cp .env.example .env
fi
chmod 600 .env || true

BWA_PROVIDED_DB_HOST="${DB_HOST:-localhost}"
BWA_PROVIDED_DB_PORT="${DB_PORT:-3306}"

bwa_provided_env_set(){ "$BWA_PROVIDED_DB_PHP" deploy/env-set.php .env "$1" "$2"; }

bwa_provided_db_log "Using the existing Hostinger MySQL database supplied for this deployment..."
bwa_provided_env_set DB_CONNECTION mysql
bwa_provided_env_set DB_HOST "$BWA_PROVIDED_DB_HOST"
bwa_provided_env_set DB_PORT "$BWA_PROVIDED_DB_PORT"
bwa_provided_env_set DB_DATABASE "$DB_DATABASE"
bwa_provided_env_set DB_USERNAME "$DB_USERNAME"
bwa_provided_env_set DB_PASSWORD "$DB_PASSWORD"
chmod 600 .env || true

if ! "$BWA_PROVIDED_DB_PHP" -r '
$dsn="mysql:host=".$argv[1].";port=".$argv[2].";dbname=".$argv[3].";charset=utf8mb4";
try {
    $pdo=new PDO($dsn,$argv[4],$argv[5],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $pdo->query("SELECT 1");
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR,$e->getMessage().PHP_EOL);
    exit(1);
}
' "$BWA_PROVIDED_DB_HOST" "$BWA_PROVIDED_DB_PORT" "$DB_DATABASE" "$DB_USERNAME" "$DB_PASSWORD"; then
  bwa_provided_db_fail "The supplied MySQL credentials were saved to .env but Hostinger MySQL rejected the connection. Verify database, user, password and assigned permissions." || return 1
fi

bwa_provided_db_log "Existing MySQL credentials verified and saved to .env."

# Do not leave the plaintext password in helper-specific variables. The exported
# DB_PASSWORD remains available only to the current deployment process and is not committed.
unset BWA_PROVIDED_DB_PHP BWA_PROVIDED_DB_HOST BWA_PROVIDED_DB_PORT
return 0 2>/dev/null || exit 0
