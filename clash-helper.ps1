# Clash助手 v3 - 动态IP地区检测
$ErrorActionPreference = "SilentlyContinue"
$clashDir = Join-Path $PSScriptRoot "clash"
$configsDir = Join-Path $clashDir "configs"
$clashExe = Join-Path $clashDir "clash.meta-windows-386.exe"
$configPath = Join-Path $clashDir "config.yaml"
$script:currentNode = 1
$script:nodeInfo = @{}

$DL_BASE = @(
    "https://www.gitlabip.xyz/Alvin9999/PAC/refs/heads/master/backup/img/1/2/ipp/clash.meta2",
    "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/clash.meta2"
)

# 防多实例
Get-Process -Name "clash.meta-windows-386" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 0.5
try {
    $check = (New-Object System.Net.Sockets.TcpClient).ConnectAsync("127.0.0.1", 9877)
    if ($check.Wait(200)) { exit 0 }
} catch { }

function Start-Clash {
    Get-Process -Name "clash.meta-windows-386" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep 0.5
    Start-Process -FilePath $clashExe -ArgumentList "-d `"$clashDir`"" -WindowStyle Hidden
}

function Stop-Clash {
    Get-Process -Name "clash.meta-windows-386" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep 0.5
}

function Download-Config($id, $savePath) {
    foreach ($base in $DL_BASE) {
        try {
            $url = "$base/$id/config.yaml"
            $wc = New-Object System.Net.WebClient
            $wc.Headers.Add("User-Agent", "Mozilla/5.0")
            $wc.DownloadFile($url, $savePath)
            if ((Test-Path $savePath) -and (Get-Item $savePath).Length -gt 100) {
                return $true
            }
        } catch { }
    }
    return $false
}

function Get-Location($configFile) {
    try {
        $content = Get-Content $configFile -Raw -Encoding UTF8
        if ($content -match 'proxies:\s*\n\s*-.*?\n.*?server:\s*(\S+).*?\n.*?port:\s*(\d+)') {
            $ip = $Matches[1]; $port = $Matches[2]
        } elseif ($content -match 'server:\s*(\d+\.\d+\.\d+\.\d+)') {
            $ip = $Matches[1]; $port = "?"
        } else {
            return @{ server = "?"; port = "?"; location = "?" }
        }
        # 通过 Clash 代理查询 IP 归属地
        $loc = "?"
        try {
            $wc = New-Object System.Net.WebClient
            $wc.Proxy = New-Object System.Net.WebProxy("http://127.0.0.1:7890")
            $wc.Headers.Add("User-Agent", "Mozilla/5.0")
            $json = $wc.DownloadString("http://ip-api.com/json/$($ip)?fields=country,city")
            $data = $json | ConvertFrom-Json
            $loc = "$($data.city), $($data.country)"
        } catch { }
        return @{ server = $ip; port = $port; location = $loc }
    } catch {
        return @{ server = "?"; port = "?"; location = "?" }
    }
}

function Switch-Node($id) {
    $tmp = Join-Path $configsDir "config_${id}_tmp.yaml"
    $cache = Join-Path $configsDir "config_${id}.yaml"

    $downloaded = Download-Config $id $tmp
    $useFile = if ($downloaded) { $tmp } elseif (Test-Path $cache) { $cache } else { return @{ ok = $false; error = "no config" } }

    Copy-Item $useFile $configPath -Force
    if ($downloaded) {
        Copy-Item $tmp $cache -Force
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }

    $script:currentNode = [int]$id
    Stop-Clash
    Start-Sleep 0.6
    Start-Clash
    Start-Sleep 1.2

    # Clash 启动后再查地区（走代理）
    $info = Get-Location $configPath
    $script:nodeInfo["$id"] = $info

    return @{
        ok = $true
        node = [int]$id
        source = if ($downloaded) { "downloaded" } else { "cached" }
        server = $info.server
        port = $info.port
        location = $info.location
    }
}

# 初始启动
$initOk = Download-Config 1 (Join-Path $configsDir "config_tmp.yaml")
if ($initOk) {
    Copy-Item (Join-Path $configsDir "config_tmp.yaml") $configPath -Force
    Copy-Item (Join-Path $configsDir "config_tmp.yaml") (Join-Path $configsDir "config_1.yaml") -Force
    Remove-Item (Join-Path $configsDir "config_tmp.yaml") -Force
} elseif (Test-Path (Join-Path $configsDir "config_1.yaml")) {
    Copy-Item (Join-Path $configsDir "config_1.yaml") $configPath -Force
}
$info = Get-Location $configPath
$script:nodeInfo["1"] = $info
Start-Clash

# HTTP API
Add-Type -AssemblyName System.Web
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:9877/")
try { $listener.Start() } catch { exit 1 }

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $resp = $ctx.Response
        $resp.Headers.Add("Access-Control-Allow-Origin", "*")
        $resp.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS")
        $resp.ContentType = "application/json; charset=utf-8"

        $path = $req.Url.AbsolutePath
        $json = "{}"

        if ($req.HttpMethod -eq "OPTIONS") {
            $resp.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
        }
        elseif ($path -eq "/status") {
            $running = Get-Process -Name "clash.meta-windows-386" -ErrorAction SilentlyContinue
            $nid = "$($script:currentNode)"
            $inf = $script:nodeInfo[$nid]
            if (-not $inf) { $inf = @{ server="?"; port="?"; location="?" } }
            $json = "{""node"": $($script:currentNode), ""running"": $(($running -ne $null).ToString().ToLower()), ""server"": ""$($inf.server):$($inf.port)"", ""location"": ""$($inf.location)""}"
        }
        elseif ($path -eq "/switch") {
            $id = $req.QueryString["id"]
            if ($id -match '^\d+$' -and [int]$id -ge 1 -and [int]$id -le 2) {
                $result = Switch-Node $id
                $json = ConvertTo-Json -InputObject $result -Compress
            } else {
                $json = "{""ok"": false, ""error"": ""invalid node $id""}"
            }
        }
        elseif ($path -eq "/reload") {
            Stop-Clash; Start-Sleep 0.3; Start-Clash
            $json = "{""ok"": true, ""node"": $($script:currentNode)}"
        }
        else {
            $json = "{""error"": ""unknown""}"
        }

        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        $resp.ContentLength64 = $bytes.Length
        $resp.OutputStream.Write($bytes, 0, $bytes.Length)
        $resp.Close()
    } catch { }
}
$listener.Stop()
