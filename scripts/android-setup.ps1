# =============================================================================
# GameTaverns Android — Clean Setup Script (Windows PowerShell)
# App ID: com.gametaverns.app
# Backend: https://gametaverns.com
#
# This script builds the ENTIRE Android project from zero.
# Run it any time you want a guaranteed-clean, Lovable-free APK.
#
# Usage (from project root):
#   powershell -ExecutionPolicy Bypass -File scripts\android-setup.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  GameTaverns Android — Clean Build" -ForegroundColor Cyan
Write-Host "  App ID : com.gametaverns.app" -ForegroundColor Cyan
Write-Host "  Backend: https://gametaverns.com" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Verify we are in the project root ─────────────────────────────────
if (-not (Test-Path "capacitor.config.ts")) {
    Write-Host "ERROR: Run this script from the GameTaverns project root." -ForegroundColor Red
    exit 1
}

# ── Step 2: Nuke the old android folder ──────────────────────────────────────
Write-Host "[1/8] Removing old android/ folder..." -ForegroundColor Yellow
if (Test-Path "android") {
    Remove-Item -Recurse -Force "android"
    Write-Host "      ✅ android/ deleted." -ForegroundColor Green
} else {
    Write-Host "      ℹ️  No android/ folder found — skipping." -ForegroundColor Gray
}

# ── Step 3: npm install ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/8] Installing npm dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: npm install failed." -ForegroundColor Red; exit 1 }
Write-Host "      ✅ npm install complete." -ForegroundColor Green

# ── Step 4: Add Android platform (creates android/ from scratch) ──────────────
Write-Host ""
Write-Host "[3/8] Adding Android platform (npx cap add android)..." -ForegroundColor Yellow
npx cap add android
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: cap add android failed." -ForegroundColor Red; exit 1 }
Write-Host "      ✅ Android platform added." -ForegroundColor Green

# ── Step 5: Build React app in android mode ───────────────────────────────────
# --mode android tells vite.config.ts to null out Lovable Cloud credentials.
Write-Host ""
Write-Host "[4/8] Building React app (--mode android)..." -ForegroundColor Yellow
npm run build -- --mode android
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: React build failed." -ForegroundColor Red; exit 1 }
Write-Host "      ✅ React build complete." -ForegroundColor Green

# ── Step 6: Sync dist/ into the Android WebView assets ───────────────────────
Write-Host ""
Write-Host "[5/8] Syncing to Android (npx cap sync android)..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: cap sync android failed." -ForegroundColor Red; exit 1 }
Write-Host "      ✅ cap sync complete." -ForegroundColor Green

# ── Step 7: Run the post-sync patcher ────────────────────────────────────────
Write-Host ""
Write-Host "[6/8] Running post-sync patcher..." -ForegroundColor Yellow
node scripts/fix-proguard.js
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: fix-proguard.js failed." -ForegroundColor Red; exit 1 }

# ── Step 8: Write gradle.properties to lock JDK path ─────────────────────────
Write-Host ""
Write-Host "[7/8] Locking Gradle JDK in gradle.properties..." -ForegroundColor Yellow
$gradleProps = "android\gradle.properties"

if (Test-Path $gradleProps) {
    $content = Get-Content $gradleProps -Raw

    # Remove any existing org.gradle.java.home line so we can replace it cleanly
    $content = $content -replace "(?m)^org\.gradle\.java\.home=.*\r?\n?", ""

    # Find JAVA_HOME from the environment
    $javaHome = [System.Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
    if (-not $javaHome) {
        $javaHome = [System.Environment]::GetEnvironmentVariable("JAVA_HOME", "User")
    }
    if (-not $javaHome) {
        # Try to find java automatically
        $javaExe = (Get-Command java -ErrorAction SilentlyContinue)?.Source
        if ($javaExe) {
            $javaHome = (Split-Path (Split-Path $javaExe))
        }
    }

    if ($javaHome) {
        # Gradle needs forward slashes
        $javaHomeForGradle = $javaHome.Replace("\", "/")
        $content = $content.TrimEnd() + "`norg.gradle.java.home=$javaHomeForGradle`n"
        Set-Content $gradleProps $content -NoNewline
        Write-Host "      ✅ Gradle JDK locked to: $javaHome" -ForegroundColor Green
    } else {
        Write-Host "      ⚠️  JAVA_HOME not found — set it manually in Android Studio." -ForegroundColor Yellow
        Write-Host "         File > Project Structure > SDK Location > Gradle JDK" -ForegroundColor Gray
    }
} else {
    Write-Host "      ⚠️  gradle.properties not found — skipping JDK lock." -ForegroundColor Yellow
}

# ── Step 9: Validate — confirm no Lovable URLs leaked into the build ──────────
Write-Host ""
Write-Host "[8/8] Validating build for Lovable URL leaks..." -ForegroundColor Yellow

$leakPatterns = @("lovableproject.com", "lovable.app", "hobby-shelf-spark", "ddfslywz")
$leakFound = $false

# Check strings.xml
$stringsXml = "android\app\src\main\res\values\strings.xml"
if (Test-Path $stringsXml) {
    $xmlContent = Get-Content $stringsXml -Raw
    foreach ($pattern in $leakPatterns) {
        if ($xmlContent -match [regex]::Escape($pattern)) {
            Write-Host "      ❌ LEAK FOUND in strings.xml: $pattern" -ForegroundColor Red
            $leakFound = $true
        }
    }
}

# Check capacitor.settings.gradle
$settingsGradle = "android\capacitor.settings.gradle"
if (Test-Path $settingsGradle) {
    $sgContent = Get-Content $settingsGradle -Raw
    foreach ($pattern in $leakPatterns) {
        if ($sgContent -match [regex]::Escape($pattern)) {
            Write-Host "      ❌ LEAK FOUND in capacitor.settings.gradle: $pattern" -ForegroundColor Red
            $leakFound = $true
        }
    }
}

if ($leakFound) {
    Write-Host ""
    Write-Host "  ⚠️  Lovable URLs found in native files. Re-run fix-proguard.js or check capacitor.config.ts." -ForegroundColor Red
} else {
    Write-Host "      ✅ No Lovable URL leaks detected." -ForegroundColor Green
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  BUILD COMPLETE" -ForegroundColor Green
Write-Host "  Open Android Studio:" -ForegroundColor Cyan
Write-Host "    npx cap open android" -ForegroundColor White
Write-Host ""
Write-Host "  Then: Build > Generate Signed Bundle/APK" -ForegroundColor Cyan
Write-Host "     OR: Click Run ▶ to push directly to device" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
