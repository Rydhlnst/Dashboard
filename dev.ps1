# =============================================================================
# dev.ps1 - One-click local development setup & server starter
# Run: powershell -ExecutionPolicy Bypass -File dev.ps1
# =============================================================================

$ProjectRoot  = $PSScriptRoot
$BackendPath  = Join-Path $ProjectRoot "backend"
$FrontendPath = Join-Path $ProjectRoot "frontend"
$EnvFile      = Join-Path $ProjectRoot ".env"
$FrontendEnv  = Join-Path $FrontendPath ".env.local"
$SetupScript  = Join-Path $BackendPath "database\setup.php"
$VendorPath   = Join-Path $BackendPath "vendor"
$NodeModules  = Join-Path $FrontendPath "node_modules"

function Write-Header($msg) {
    Write-Host ""
    Write-Host ("=" * 52) -ForegroundColor Magenta
    Write-Host "  $msg" -ForegroundColor Magenta
    Write-Host ("=" * 52) -ForegroundColor Magenta
}
function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    >>  $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "    !!  $msg" -ForegroundColor Red }

# ── Find PHP ──────────────────────────────────────────────────────────────────
function Find-PHP {
    $cmd = Get-Command php -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @()

    $laragonBase = "C:\laragon\bin\php"
    if (Test-Path $laragonBase) {
        Get-ChildItem $laragonBase -Directory | Sort-Object Name -Descending | ForEach-Object {
            $candidates += (Join-Path $_.FullName "php.exe")
        }
    }

    $candidates += "C:\xampp\php\php.exe"

    $wampBase = "C:\wamp64\bin\php"
    if (Test-Path $wampBase) {
        Get-ChildItem $wampBase -Directory | Sort-Object Name -Descending | ForEach-Object {
            $candidates += (Join-Path $_.FullName "php.exe")
        }
    }

    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

# ── Find Composer ─────────────────────────────────────────────────────────────
function Find-Composer {
    $cmd = Get-Command composer -ErrorAction SilentlyContinue
    if ($cmd) { return @("composer") }

    $candidates = @(
        "$env:USERPROFILE\AppData\Roaming\Composer\vendor\bin\composer.bat",
        "C:\ProgramData\ComposerSetup\bin\composer.bat",
        "C:\laragon\bin\composer\composer.bat",
        (Join-Path $ProjectRoot "composer.phar")
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            if ($c -like "*.phar") { return @($script:phpExe, $c) }
            return @($c)
        }
    }
    return $null
}

# ── Find pnpm ─────────────────────────────────────────────────────────────────
function Find-PNPM {
    $cmd = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $npm = "$env:APPDATA\npm\pnpm.cmd"
    if (Test-Path $npm) { return $npm }
    return $null
}

# =============================================================================
Write-Header "Dashboard Monitoring - Local Dev Setup"

# ── PHP ───────────────────────────────────────────────────────────────────────
Write-Step "Checking PHP..."
$phpExe = Find-PHP
if (-not $phpExe) {
    Write-Fail "PHP not found."
    Write-Fail "Install Laragon: https://laragon.org  or  XAMPP: https://apachefriends.org"
    Read-Host "`nPress Enter to exit"
    exit 1
}
$phpVer = & "$phpExe" -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;"
Write-Ok "PHP $phpVer -> $phpExe"

if ([int]($phpVer.Split('.')[0]) -lt 8) {
    Write-Fail "PHP 8.0+ required. Found: $phpVer"
    Read-Host "`nPress Enter to exit"
    exit 1
}

# ── pnpm ──────────────────────────────────────────────────────────────────────
Write-Step "Checking pnpm..."
$pnpmExe = Find-PNPM
if (-not $pnpmExe) {
    Write-Warn "pnpm not found. Installing via npm..."
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npmCmd) {
        Write-Fail "Node.js not found. Install from https://nodejs.org"
        Read-Host "`nPress Enter to exit"
        exit 1
    }
    npm install -g pnpm --silent
    $pnpmExe = Find-PNPM
    if (-not $pnpmExe) {
        Write-Fail "pnpm install failed. Run manually: npm install -g pnpm"
        Read-Host "`nPress Enter to exit"
        exit 1
    }
}
$pnpmVer = & "$pnpmExe" --version 2>$null
Write-Ok "pnpm $pnpmVer"

# ── Composer ──────────────────────────────────────────────────────────────────
Write-Step "Checking Composer..."
$composerArgs = Find-Composer
if (-not $composerArgs) {
    Write-Fail "Composer not found. Download from https://getcomposer.org/download/"
    Read-Host "`nPress Enter to exit"
    exit 1
}
Write-Ok "Composer -> $($composerArgs -join ' ')"

# ── .env ──────────────────────────────────────────────────────────────────────
Write-Step "Checking .env..."
if (-not (Test-Path $EnvFile)) {
    $mysqlPass = Read-Host "  MySQL root password (press Enter if none)"
$envContent = @"
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=dashboard_monitoring
DB_USER=root
DB_PASS=$mysqlPass

FRONTEND_URL=http://localhost:3000
"@
    $envContent | Out-File -FilePath $EnvFile -Encoding utf8 -NoNewline
    Write-Ok ".env created"
} else {
    Write-Ok ".env already exists - skipping"
}

# ── frontend/.env.local ───────────────────────────────────────────────────────
Write-Step "Checking frontend/.env.local..."
if (-not (Test-Path $FrontendEnv)) {
    "NEXT_PUBLIC_API_URL=http://localhost:8000" |
        Out-File -FilePath $FrontendEnv -Encoding utf8 -NoNewline
    Write-Ok "frontend/.env.local created (API -> localhost:8000)"
} else {
    Write-Ok "frontend/.env.local already exists - skipping"
}

# ── composer install ──────────────────────────────────────────────────────────
Write-Step "PHP dependencies (composer install)..."
if (-not (Test-Path $VendorPath)) {
    Push-Location $BackendPath
    $composerExe  = $composerArgs[0]
    $composerRest = $composerArgs[1..99] + @("install", "--no-interaction", "--no-progress")
    & "$composerExe" $composerRest
    Pop-Location
    if (-not (Test-Path $VendorPath)) {
        Write-Fail "composer install failed. Check the output above."
        Read-Host "`nPress Enter to exit"
        exit 1
    }
    Write-Ok "PHP dependencies installed"
} else {
    Write-Ok "vendor/ already exists - skipping"
}

# ── database setup ────────────────────────────────────────────────────────────
Write-Step "Setting up database..."
$dbOut = & "$phpExe" $SetupScript 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Database setup failed:"
    Write-Host ($dbOut | Out-String) -ForegroundColor Red
    Write-Warn "Make sure MySQL is running:"
    Write-Warn "  Laragon : click 'Start All' in the Laragon window"
    Write-Warn "  XAMPP   : start MySQL in XAMPP Control Panel"
    Read-Host "`nPress Enter to exit"
    exit 1
}
$dbOut | ForEach-Object { Write-Ok $_ }

# ── pnpm install ──────────────────────────────────────────────────────────────
Write-Step "Frontend dependencies (pnpm install)..."
if (-not (Test-Path $NodeModules)) {
    Push-Location $FrontendPath
    & "$pnpmExe" install
    Pop-Location
    Write-Ok "Frontend dependencies installed"
} else {
    Write-Ok "node_modules already exists - skipping"
}

# ── start servers ─────────────────────────────────────────────────────────────
Write-Header "Starting Servers"

Write-Host ""
Write-Host "  Backend  (PHP)     ->  http://localhost:8000" -ForegroundColor Cyan
Write-Host "  Frontend (Next.js) ->  http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login: admin@example.com / password" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Press Ctrl+C to stop all servers." -ForegroundColor DarkGray
Write-Host ""

# PHP built-in server in background (minimized)
$phpServerProc = Start-Process `
    -FilePath "$phpExe" `
    -ArgumentList @("-S", "localhost:8000", "-t", $BackendPath) `
    -WindowStyle Minimized `
    -PassThru

Start-Sleep -Seconds 1

# Open browser after delay (background job)
$null = Start-Job -ScriptBlock {
    Start-Sleep -Seconds 5
    Start-Process "http://localhost:3000"
}

# Next.js dev server in foreground
Push-Location $FrontendPath
try {
    & "$pnpmExe" dev
} finally {
    Write-Host ""
    Write-Host "Stopping PHP server (PID $($phpServerProc.Id))..." -ForegroundColor DarkGray
    Stop-Process -Id $phpServerProc.Id -Force -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -Force -ErrorAction SilentlyContinue
    Pop-Location
    Write-Host "All servers stopped." -ForegroundColor Green
}
