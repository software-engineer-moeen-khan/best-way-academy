<?php
if ($argc < 4) { fwrite(STDERR, "Usage: php env-set.php <file> <key> <value>\n"); exit(2); }
[$script,$file,$key,$value]=$argv;
$lines=file_exists($file)?file($file, FILE_IGNORE_NEW_LINES):[];
$found=false;
foreach($lines as &$line){ if(str_starts_with($line,$key.'=')){ $line=$key.'='.quoteEnv($value); $found=true; break; } }
unset($line);
if(!$found)$lines[]=$key.'='.quoteEnv($value);
file_put_contents($file,implode(PHP_EOL,$lines).PHP_EOL);
function quoteEnv(string $v): string { if($v===''||preg_match('/[\s#="\'\\$]/',$v)) return '"'.addcslashes($v,"\\\"").'"'; return $v; }
