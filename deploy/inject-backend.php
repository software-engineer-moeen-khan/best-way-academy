<?php
if ($argc < 3) { fwrite(STDERR,"Usage: php inject-backend.php <source.html> <target.html>\n"); exit(2); }
$html=file_get_contents($argv[1]);
$tag='<script src="assets/backend-sync.js?v=20260808-1"></script>';
if(!str_contains($html,'backend-sync.js')) $html=str_ireplace('</body>',$tag."\n</body>",$html);
file_put_contents($argv[2],$html);
