<?php
if ($argc < 4) {
    fwrite(STDERR, "Usage: php env-set.php <file> <key> <value>\n");
    exit(2);
}

[$script, $file, $key, $value] = $argv;
$lines = file_exists($file) ? file($file, FILE_IGNORE_NEW_LINES) : [];
$replacement = $key.'='.quoteEnv($value);
$out = [];
$written = false;

foreach ($lines as $line) {
    if (preg_match('/^'.preg_quote($key, '/').'\s*=/', $line)) {
        // Replace the first active occurrence and drop any later duplicates so
        // Laravel/PHP cannot read a stale value from the same .env file.
        if (! $written) {
            $out[] = $replacement;
            $written = true;
        }
        continue;
    }

    $out[] = $line;
}

if (! $written) {
    $out[] = $replacement;
}

$temp = $file.'.tmp.'.getmypid();
file_put_contents($temp, implode(PHP_EOL, $out).PHP_EOL, LOCK_EX);
chmod($temp, 0600);
rename($temp, $file);

function quoteEnv(string $v): string
{
    if ($v === '' || preg_match('/[\s#="\'\\$]/', $v)) {
        return '"'.addcslashes($v, "\\\"").'"';
    }

    return $v;
}
