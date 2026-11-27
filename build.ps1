param(
    # -Test：只编译并运行扫描逻辑的回归测试，不打包、不打扰正在运行的 Toolbox。
    [switch]$Test
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$gxx = 'D:\SoftWare\msys64\ucrt64\bin\g++.exe'
$windres = 'D:\SoftWare\msys64\ucrt64\bin\windres.exe'
# cc1plus.exe / ld.exe 依赖同目录 DLL，必须让它们在 PATH 里，否则会静默失败（退出码 1、零输出）。
$env:PATH = 'D:\SoftWare\msys64\ucrt64\bin;' + $env:PATH

if ($Test) {
    $out = Join-Path $root 'build'
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    # 只链扫描与重复查找两条链路需要的实现文件：不需要 WebView2、不需要资源，
    # 所以跑一次只要一两秒，适合每次改完扫描代码就执行。
    $testSources = @(
        (Join-Path $root 'tests\scan_tests.cpp'),
        (Join-Path $root 'src\scanner.cpp'),
        (Join-Path $root 'src\tasks.cpp'),
        (Join-Path $root 'src\tools\drive_roots.cpp')
    )
    $testExe = Join-Path $out 'scan_tests.exe'
    & $gxx '-std=c++20' '-O1' '-finput-charset=UTF-8' '-DUNICODE' '-D_UNICODE' `
        '-Isrc' @testSources '-o' $testExe `
        '-municode' '-lbcrypt' '-lrstrtmgr' '-lole32' '-luuid' '-lshell32' '-lshlwapi' '-ladvapi32' '-static'
    if ($LASTEXITCODE -ne 0) { throw 'scan_tests build failed' }
    & $testExe
    if ($LASTEXITCODE -ne 0) { throw "scan_tests failed (exit $LASTEXITCODE)" }
    exit 0
}

# A running Toolbox keeps the dist exe locked. Ask it to close gracefully and
# fail the build if it refuses; never force-kill a user's running scans.
$running = @(Get-Process Toolbox -ErrorAction SilentlyContinue)
if ($running.Count -gt 0) {
    Write-Host 'Toolbox is running; requesting graceful quit...'
    $exePath = Join-Path $root 'dist\Toolbox.exe'
    if (Test-Path $exePath) {
        & $exePath --quit | Out-Null
        Start-Sleep -Milliseconds 1500
    }
    $remaining = @(Get-Process Toolbox -ErrorAction SilentlyContinue)
    if ($remaining.Count -gt 0) {
        # 关闭按钮现在只是收进托盘，脚本必须能强制收尾，否则构建会被旧进程锁住。
        Write-Host 'Still running; stopping the leftover process.'
        $remaining | Stop-Process -Force
        Start-Sleep -Milliseconds 800
    }
}

$out = Join-Path $root 'build'
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $out, $dist | Out-Null

# 0. One version, one file. version.txt is the only place a release number is
# written; headers for both the C++ side and the resource compiler are generated
# here so exe properties and the in-app version can never drift apart.
$versionFile = Join-Path $root 'version.txt'
if (-not (Test-Path $versionFile)) { throw 'version.txt is missing' }
$version = (Get-Content $versionFile -Raw).Trim()
if ($version -notmatch '^[0-9]+\.[0-9]+\.[0-9]+$') {
    throw "version.txt must look like 0.4.0, got '$version'"
}
$verParts = @($version.Split('.')) + '0'
$verNum = ($verParts[0..3] -join ',')
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $out 'version.h'), @"
#pragma once
#define TB_VERSION_STRING L"$version"
"@, $utf8)
[IO.File]::WriteAllText((Join-Path $out 'version_rc.h'), @"
#define TB_VER_NUM $verNum
#define TB_VERSION_STR "$version"
"@, $utf8)
Write-Host "Version: $version ($verNum)"

# 1. Build one self-contained HTML document from the maintained sources.
$html = Get-Content (Join-Path $root 'web\index.html') -Raw -Encoding UTF8
$css = Get-Content (Join-Path $root 'web\styles.css') -Raw -Encoding UTF8
# 前端按 web\js\NN-*.js 的顺序拼接：文件名前缀决定顺序，拆开写只为可读。
# 产物仍是单文件内联 HTML，运行时不多发一个请求。
$jsParts = Get-ChildItem (Join-Path $root 'web\js') -Filter '*.js' | Sort-Object Name
if ($jsParts.Count -eq 0) { throw 'web\js has no script parts' }
$js = ($jsParts | ForEach-Object { Get-Content $_.FullName -Raw -Encoding UTF8 }) -join "`n"

$inline = $html.Replace('<link rel="stylesheet" href="styles.css">', "<style>`n$css`n</style>")
$inline = $inline.Replace('<script src="app.js"></script>', "<script>`n$js`n</script>")
$inlinePath = Join-Path $out 'embedded-index.html'
[IO.File]::WriteAllText($inlinePath, $inline, (New-Object System.Text.UTF8Encoding($false)))

# 2. App manifest, icon, version info.
Push-Location (Join-Path $root 'resources')
try {
    & $windres --codepage=65001 "--include-dir=$out" app.rc -O coff -o (Join-Path $out 'app.res')
    if ($LASTEXITCODE -ne 0) { throw 'windres app.rc failed' }
} finally {
    Pop-Location
}

# 3. WebView2 loader + HTML as embedded resources, so the result is one exe.
$loaderPath = (Resolve-Path 'third_party\webview2\build\native\x64\WebView2Loader.dll').Path.Replace('\', '/')
$htmlResPath = (Resolve-Path $inlinePath).Path.Replace('\', '/')
$embeddedRc = @"
#include <windows.h>
100 RCDATA "$loaderPath"
101 RCDATA "$htmlResPath"
"@
$embeddedRcPath = Join-Path $out 'embedded.rc'
[IO.File]::WriteAllText($embeddedRcPath, $embeddedRc, (New-Object System.Text.UTF8Encoding($false)))
& $windres --codepage=65001 $embeddedRcPath -O coff -o (Join-Path $out 'embedded.res')
if ($LASTEXITCODE -ne 0) { throw 'windres embedded.rc failed' }

# 4. Compile and link.
$src = Get-ChildItem (Join-Path $root 'src') -Recurse -Filter *.cpp |
       ForEach-Object { $_.FullName }

$arguments = @(
    '-std=c++20', '-O2',
    '-DUNICODE', '-D_UNICODE',
    '-finput-charset=UTF-8',
    '-municode', '-mwindows',
    '-Isrc',
    "-I$out",
    '-Ithird_party/webview2/build/native/include'
) + $src + @(
    (Join-Path $out 'app.res'),
    (Join-Path $out 'embedded.res'),
    '-o', (Join-Path $out 'Toolbox.exe'),
    '-lole32', '-loleaut32', '-luuid', '-lshell32', '-lshlwapi',
    '-ldwmapi', '-lcomdlg32', '-lpropsys', '-lcomctl32',
    '-luser32', '-lgdi32', '-lgdiplus', '-ladvapi32', '-lbcrypt', '-lrstrtmgr',
    '-static'
)

& $gxx @arguments
if ($LASTEXITCODE -ne 0) { throw 'g++ failed' }

# 5. A single-file distribution copy.
Copy-Item (Join-Path $out 'Toolbox.exe') (Join-Path $dist 'Toolbox.exe') -Force

# Do not ship a self-signed certificate or a "trust this root" helper. A
# self-signed root does not establish SmartScreen reputation and asking users
# to install one is a security anti-pattern. Use a real OV/EV certificate if
# trusted distribution is required.

# Remove stale side-by-side assets that would mask the embedded path.
Remove-Item (Join-Path $out 'WebView2Loader.dll') -ErrorAction SilentlyContinue
Remove-Item (Join-Path $out 'web') -Recurse -Force -ErrorAction SilentlyContinue

# 5.2 Repackage only the actual deliverables. Never glob the whole dist
# directory: test screenshots and debug logs have leaked into releases before.
# $version comes from version.txt near the top of this script.

Get-ChildItem $dist -Filter 'Toolbox-*-win64.zip' -File |
    Remove-Item -Force -ErrorAction SilentlyContinue

# Keep this ASCII-only: Windows PowerShell reads this file as ANSI. Pick the
# usage text by wildcard rather than embedding a non-ASCII file name literal.
$zipFiles = @(
    (Join-Path $dist 'Toolbox.exe')
) + @(Get-ChildItem $dist -Filter '*.txt' -File | Select-Object -ExpandProperty FullName)
if ($zipFiles.Count -gt 0) {
    $zipPath = Join-Path $dist ("Toolbox-$version-win64.zip")
    Compress-Archive -Path $zipFiles -DestinationPath $zipPath -Force
    Write-Host "Packaged: $zipPath"
}

# Remove leftovers from older builds so the distribution folder stays clean.
Remove-Item (Join-Path $dist 'Toolbox.cer') -ErrorAction SilentlyContinue
Remove-Item (Join-Path $dist 'trust-cert.bat') -ErrorAction SilentlyContinue

Write-Host ''
Write-Host "Built: $dist\Toolbox.exe"
Get-Item (Join-Path $dist 'Toolbox.exe') | Select-Object Name, Length, LastWriteTime
