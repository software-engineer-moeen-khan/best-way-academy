<?php

if ($argc < 3) {
    fwrite(STDERR, "Usage: php env-get.php <file> <key>\n");
    exit(2);
}

[, $file, $key] = $argv;
if (! is_file($file)) {
    exit(0);
}

$value = null;
$pattern = '/^\s*(?:export\s+)?'.preg_quote($key, '/').'\s*=\s*(.*)$/';

foreach (file($file, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
    if (! preg_match($pattern, $line, $match)) {
        continue;
    }

    // Last active occurrence wins, matching normal dotenv behavior if a legacy
    // file still contains duplicates. env-set.php removes duplicates on write.
    $value = decodeDotenvValue($match[1]);
}

if ($value !== null) {
    echo $value;
}

function decodeDotenvValue(string $raw): string
{
    $raw = trim($raw);
    if ($raw === '') {
        return '';
    }

    $first = $raw[0];
    if (($first === '"' || $first === "'") && strlen($raw) >= 2) {
        $quote = $first;
        $end = strlen($raw) - 1;
        while ($end > 0 && ctype_space($raw[$end])) {
            $end--;
        }

        if ($raw[$end] === $quote) {
            $inner = substr($raw, 1, $end - 1);
            if ($quote === '"') {
                // env-set.php escapes only backslashes and double quotes.
                $inner = str_replace(['\\\\', '\\"'], ['\\', '"'], $inner);
            }
            return $inner;
        }
    }

    // For unquoted values, an inline comment starts only after whitespace.
    if (preg_match('/^(.*?)(?:\s+#.*)?$/', $raw, $match)) {
        return rtrim($match[1]);
    }

    return $raw;
}
