$out = ".planning/phases/036-dns-ssl-cutover/evidence/08-3-resolver-matrix.txt"
$expectedA = "76.76.21.21"
$expectedCname = "cname.vercel-dns.com"

Set-Content -Path $out -Value ""
"DEP-DNS-04 - 3-resolver propagation matrix" | Add-Content $out
("Generated: " + (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')) | Add-Content $out
("Expected A:     " + $expectedA) | Add-Content $out
("Expected CNAME: " + $expectedCname) | Add-Content $out
"" | Add-Content $out

$resolvers = @('1.1.1.1','8.8.8.8','9.9.9.9')
$aCount = 0
$cnameCount = 0

foreach ($r in $resolvers) {
    ("=== Resolver " + $r + " - A digswap.com.br ===") | Add-Content $out
    try {
        $ans = Resolve-DnsName -Name digswap.com.br -Type A -Server $r -ErrorAction Stop -DnsOnly
        $ans | Format-List Name, Type, IPAddress, TTL | Out-String | Add-Content $out
        if ($ans.IPAddress -contains $expectedA) {
            $aCount++
            "[ok] matched expected A" | Add-Content $out
        } else {
            "[FAIL] expected A not in answer" | Add-Content $out
        }
    } catch {
        ("[error] " + $_.Exception.Message) | Add-Content $out
    }

    ("=== Resolver " + $r + " - CNAME www.digswap.com.br ===") | Add-Content $out
    try {
        $ans2 = Resolve-DnsName -Name www.digswap.com.br -Type CNAME -Server $r -ErrorAction Stop -DnsOnly
        $ans2 | Format-List Name, Type, NameHost, TTL | Out-String | Add-Content $out
        $nh = ($ans2 | Where-Object { $_.Type -eq 'CNAME' } | Select-Object -ExpandProperty NameHost) -join ','
        if ($nh -like ('*' + $expectedCname + '*')) {
            $cnameCount++
            "[ok] matched expected CNAME" | Add-Content $out
        } else {
            "[FAIL] expected CNAME not in answer" | Add-Content $out
        }
    } catch {
        ("[error] " + $_.Exception.Message) | Add-Content $out
    }
    "" | Add-Content $out
}

"" | Add-Content $out
("Resolvers passing A:     " + $aCount + " / 3") | Add-Content $out
("Resolvers passing CNAME: " + $cnameCount + " / 3") | Add-Content $out
$status = if (($aCount -ge 2) -and ($cnameCount -ge 2)) { "PASS" } else { "FAIL" }
("DEP-DNS-04 status: " + $status) | Add-Content $out
