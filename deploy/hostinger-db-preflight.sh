#!/usr/bin/env bash
# Sourced by deploy.sh before the main Hostinger deployment.
# Ensures a usable MySQL database exists and writes its credentials to .env.

BWA_DB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BWA_DB_API_BASE="https://developers.hostinger.com"

bwa_db_log(){ printf '\033[1;36m[BWA DB]\033[0m %s\n' "$*"; }
bwa_db_fail(){ printf '\033[1;31m[BWA DB ERROR]\033[0m %s\n' "$*" >&2; return 1; }

cd "$BWA_DB_ROOT"

BWA_DB_PHP=""
for c in php php84 php83 php82; do
  if command -v "$c" >/dev/null 2>&1; then
    if "$c" -r 'exit(version_compare(PHP_VERSION,"8.2.0",">=")?0:1);' >/dev/null 2>&1; then
      BWA_DB_PHP="$(command -v "$c")"
      break
    fi
  fi
done
[[ -n "$BWA_DB_PHP" ]] || bwa_db_fail "PHP 8.2+ CLI is required." || return 1
[[ -f deploy/env-set.php && -f deploy/env-get.php ]] || bwa_db_fail "deploy/env-set.php or deploy/env-get.php is missing." || return 1

if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env || true
fi

bwa_env_get(){ "$BWA_DB_PHP" deploy/env-get.php .env "$1" 2>/dev/null || true; }
bwa_env_set(){ "$BWA_DB_PHP" deploy/env-set.php .env "$1" "$2"; }

BWA_DB_DATABASE="$(bwa_env_get DB_DATABASE)"
BWA_DB_USERNAME="$(bwa_env_get DB_USERNAME)"
BWA_DB_PASSWORD="$(bwa_env_get DB_PASSWORD)"

# If production DB credentials already exist, the main deploy script will verify
# them and repair the password through Hostinger if necessary.
if [[ -n "$BWA_DB_DATABASE" && -n "$BWA_DB_USERNAME" && -n "$BWA_DB_PASSWORD" ]]; then
  bwa_db_log "Database credentials already exist in .env; preserving them."
  return 0 2>/dev/null || exit 0
fi

BWA_HOSTINGER_USERNAME="${HOSTINGER_USERNAME:-}"
BWA_HOSTINGER_DOMAIN="${HOSTINGER_DOMAIN:-}"
if [[ -z "$BWA_HOSTINGER_USERNAME" && "$BWA_DB_ROOT" =~ /home/(u[0-9]+)/ ]]; then
  BWA_HOSTINGER_USERNAME="${BASH_REMATCH[1]}"
fi
if [[ -z "$BWA_HOSTINGER_DOMAIN" && "$BWA_DB_ROOT" =~ /domains/([^/]+) ]]; then
  BWA_HOSTINGER_DOMAIN="${BASH_REMATCH[1]}"
fi
[[ -n "$BWA_HOSTINGER_USERNAME" ]] || read -rp "Hostinger account username (u123456789): " BWA_HOSTINGER_USERNAME
[[ -n "$BWA_HOSTINGER_DOMAIN" ]] || read -rp "Domain (example.com): " BWA_HOSTINGER_DOMAIN

export HOSTINGER_USERNAME="$BWA_HOSTINGER_USERNAME"
export HOSTINGER_DOMAIN="$BWA_HOSTINGER_DOMAIN"

if [[ -z "${HOSTINGER_API_TOKEN:-}" ]]; then
  printf 'Hostinger API token (input hidden; used only during deployment): '
  read -rs HOSTINGER_API_TOKEN
  printf '\n'
fi
[[ -n "${HOSTINGER_API_TOKEN:-}" ]] || bwa_db_fail "Hostinger API token is required." || return 1
export HOSTINGER_API_TOKEN

BWA_API_STATUS=""
BWA_API_RESPONSE=""
bwa_api_request(){
  local method="$1" url="$2" body="${3:-}" tmp
  tmp="$(mktemp)"
  if [[ -n "$body" ]]; then
    BWA_API_STATUS="$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" "$url" \
      -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
      -H 'Accept: application/json' -H 'Content-Type: application/json' \
      --data "$body" || true)"
  else
    BWA_API_STATUS="$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" "$url" \
      -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
      -H 'Accept: application/json' || true)"
  fi
  BWA_API_RESPONSE="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"
}

bwa_list_databases(){
  # Intentionally list the whole account. Filtering by domain can hide an
  # unassigned database left by an earlier/partial deployment.
  bwa_api_request GET "$BWA_DB_API_BASE/api/hosting/v1/accounts/$BWA_HOSTINGER_USERNAME/databases?per_page=100"
  [[ "$BWA_API_STATUS" == "200" ]]
}

bwa_find_existing_academy_db(){
  local json="$1"
  printf '%s' "$json" | D="$BWA_HOSTINGER_DOMAIN" "$BWA_DB_PHP" -r '
    $j=json_decode(stream_get_contents(STDIN),true);
    $rows=$j["data"]??$j;
    if(!is_array($rows)) exit(1);
    foreach($rows as $d){
      $name=(string)($d["name"]??"");
      $user=(string)($d["user"]??"");
      $domain=$d["domain"]??null;
      if(str_ends_with($name,"_bwa_academy") && ($domain===null || $domain==="" || $domain===getenv("D"))){
        echo $name,"\n",$user;
        exit(0);
      }
    }
    exit(1);
  ' 2>/dev/null
}

bwa_write_db_env(){
  bwa_env_set DB_CONNECTION mysql
  bwa_env_set DB_HOST localhost
  bwa_env_set DB_PORT 3306
  bwa_env_set DB_DATABASE "$1"
  bwa_env_set DB_USERNAME "$2"
  bwa_env_set DB_PASSWORD "$3"
  chmod 600 .env || true
}

bwa_reset_and_use_existing(){
  local db="$1" user="$2" password body connected=0
  password="$($BWA_DB_PHP -r 'echo rtrim(strtr(base64_encode(random_bytes(24)),"+/","AZ"),"=")."aA9!";')"
  body="$($BWA_DB_PHP -r 'echo json_encode(["password"=>$argv[1]],JSON_UNESCAPED_SLASHES);' "$password")"
  bwa_db_log "Existing Best Way Academy database found; synchronizing its credentials..."
  bwa_api_request PATCH "$BWA_DB_API_BASE/api/hosting/v1/accounts/$BWA_HOSTINGER_USERNAME/databases/$db/change-password" "$body"
  if [[ "$BWA_API_STATUS" != "200" ]]; then
    bwa_db_fail "Hostinger could not reset database credentials (HTTP $BWA_API_STATUS): $BWA_API_RESPONSE" || return 1
  fi
  bwa_write_db_env "$db" "$user" "$password"
  for attempt in {1..15}; do
    if "$BWA_DB_PHP" -r '$dsn="mysql:host=localhost;port=3306;dbname=".$argv[1].";charset=utf8mb4";try{$pdo=new PDO($dsn,$argv[2],$argv[3],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$pdo->query("SELECT 1");exit(0);}catch(Throwable $e){exit(1);}' "$db" "$user" "$password" >/dev/null 2>&1; then
      connected=1
      break
    fi
    sleep 2
  done
  [[ "$connected" -eq 1 ]] || bwa_db_fail "Database exists but MySQL did not accept the synchronized credentials." || return 1
  bwa_db_log "Existing MySQL database verified."
}

bwa_db_log "Checking Hostinger MySQL databases..."
if ! bwa_list_databases; then
  bwa_db_fail "Could not list Hostinger databases (HTTP $BWA_API_STATUS): $BWA_API_RESPONSE" || return 1
fi

BWA_EXISTING_MATCH="$(bwa_find_existing_academy_db "$BWA_API_RESPONSE" || true)"
if [[ -n "$BWA_EXISTING_MATCH" ]]; then
  BWA_EXISTING_DB="$(printf '%s\n' "$BWA_EXISTING_MATCH" | sed -n '1p')"
  BWA_EXISTING_USER="$(printf '%s\n' "$BWA_EXISTING_MATCH" | sed -n '2p')"
  bwa_reset_and_use_existing "$BWA_EXISTING_DB" "$BWA_EXISTING_USER" || return 1
  return 0 2>/dev/null || exit 0
fi

# Use a deterministic domain-specific suffix. This avoids a 422 caused by a
# database name already being used elsewhere on the same hosting account, while
# remaining stable for this website. Hostinger adds the u123... prefix.
BWA_HASH="$($BWA_DB_PHP -r 'echo substr(sha1($argv[1]),0,7);' "$BWA_HOSTINGER_DOMAIN")"
BWA_DB_SUFFIX="bwa_${BWA_HASH}"
BWA_USER_SUFFIX="bwa_${BWA_HASH}"
BWA_NEW_PASSWORD="$($BWA_DB_PHP -r 'echo rtrim(strtr(base64_encode(random_bytes(24)),"+/","AZ"),"=")."aA9!";')"
BWA_CREATE_BODY="$($BWA_DB_PHP -r 'echo json_encode(["name"=>$argv[1],"user"=>$argv[2],"password"=>$argv[3],"website_domain"=>$argv[4]],JSON_UNESCAPED_SLASHES);' "$BWA_DB_SUFFIX" "$BWA_USER_SUFFIX" "$BWA_NEW_PASSWORD" "$BWA_HOSTINGER_DOMAIN")"

bwa_db_log "Creating MySQL database/user through Hostinger API..."
bwa_api_request POST "$BWA_DB_API_BASE/api/hosting/v1/accounts/$BWA_HOSTINGER_USERNAME/databases" "$BWA_CREATE_BODY"
if [[ "$BWA_API_STATUS" != "200" ]]; then
  bwa_db_fail "Hostinger rejected database creation (HTTP $BWA_API_STATUS): $BWA_API_RESPONSE" || return 1
fi

BWA_CREATED_DB=""
BWA_CREATED_USER=""
for attempt in {1..15}; do
  sleep 2
  if bwa_list_databases; then
    BWA_CREATED_MATCH="$(printf '%s' "$BWA_API_RESPONSE" | S="$BWA_DB_SUFFIX" D="$BWA_HOSTINGER_DOMAIN" "$BWA_DB_PHP" -r '
      $j=json_decode(stream_get_contents(STDIN),true);$rows=$j["data"]??$j;if(!is_array($rows))exit(1);
      foreach($rows as $d){$n=(string)($d["name"]??"");$domain=$d["domain"]??null;if(str_ends_with($n,"_".getenv("S"))&&($domain===null||$domain===""||$domain===getenv("D"))){echo $n,"\n",(string)($d["user"]??"");exit(0);}}exit(1);
    ' 2>/dev/null || true)"
    if [[ -n "$BWA_CREATED_MATCH" ]]; then
      BWA_CREATED_DB="$(printf '%s\n' "$BWA_CREATED_MATCH" | sed -n '1p')"
      BWA_CREATED_USER="$(printf '%s\n' "$BWA_CREATED_MATCH" | sed -n '2p')"
      break
    fi
  fi
  bwa_db_log "Waiting for Hostinger database provisioning ($attempt/15)..."
done

[[ -n "$BWA_CREATED_DB" && -n "$BWA_CREATED_USER" ]] || bwa_db_fail "Hostinger accepted database creation but the new database could not be resolved." || return 1
bwa_write_db_env "$BWA_CREATED_DB" "$BWA_CREATED_USER" "$BWA_NEW_PASSWORD"
bwa_db_log "Database created and production credentials saved to .env."

unset BWA_NEW_PASSWORD BWA_CREATE_BODY BWA_API_RESPONSE
return 0 2>/dev/null || exit 0
