# =============================================================================
# GameTaverns Android - Clean Setup Script (Windows PowerShell 5.1+)
# App ID: com.gametaverns.app
# Backend: https://gametaverns.com
#
# Usage (from project root):
#   powershell -ExecutionPolicy Bypass -File scripts\android-setup.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================"
Write-Host "  GameTaverns Android - Clean Build"
Write-Host "  App ID : com.gametaverns.app"
Write-Host "  Backend: https://gametaverns.com"
Write-Host "============================================================"
Write-Host ""

# Verify we are in the project root
if (-not (Test-Path "capacitor.config.ts")) {
    Write-Host "ERROR: Run this script from the GameTaverns project root."
    exit 1
}

# ── Step 1: Nuke the old android folder ──────────────────────────────────────
Write-Host "[1/8] Removing old android/ folder..."
if (Test-Path "android") {
    Remove-Item -Recurse -Force "android"
    Write-Host "      OK - android/ deleted."
} else {
    Write-Host "      OK - No android/ folder found, skipping."
}

# ── Step 2: npm install ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/8] Installing npm dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: npm install failed."; exit 1 }
Write-Host "      OK - npm install complete."

# ── Step 3: Add Android platform ─────────────────────────────────────────────
Write-Host ""
Write-Host "[3/8] Adding Android platform..."
npx cap add android
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: cap add android failed."; exit 1 }
Write-Host "      OK - Android platform added."

# ── Step 3b: Copy google-services.json if present ────────────────────────────
$gsJson = "google-services.json"
$gsDest = "android\app\google-services.json"
if (Test-Path $gsJson) {
    Copy-Item $gsJson $gsDest -Force
    Write-Host "      OK - google-services.json copied to android/app/."
} else {
    Write-Host "      WARN - google-services.json not found in project root."
    Write-Host "             Push notifications will not work without it."
    Write-Host "             Place it at: $((Get-Location).Path)\$gsJson"
}

# ── Step 4: Build React app in android mode ───────────────────────────────────
Write-Host ""
Write-Host "[4/8] Building React app (--mode android, no Lovable URLs)..."
npm run build -- --mode android
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: React build failed."; exit 1 }
Write-Host "      OK - React build complete."

# ── Step 5: Sync to Android ───────────────────────────────────────────────────
Write-Host ""
Write-Host "[5/8] Syncing to Android..."
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: cap sync android failed."; exit 1 }
Write-Host "      OK - cap sync complete."

# ── Step 6: Upgrade Gradle wrapper to latest ─────────────────────────────────
Write-Host ""
Write-Host "[6/10] Upgrading Gradle wrapper to 9.1.0..."
$wrapperProps = "android\gradle\wrapper\gradle-wrapper.properties"
if (Test-Path $wrapperProps) {
    $wContent = Get-Content $wrapperProps -Raw
    # Replace the entire distributionUrl line regardless of current version/format
    $wContent = $wContent -replace "(?m)^distributionUrl=.*$", "distributionUrl=https\://services.gradle.org/distributions/gradle-9.1.0-all.zip"
    Set-Content -Path $wrapperProps -Value $wContent -NoNewline
    # Verify it worked
    if ((Get-Content $wrapperProps -Raw) -match "9\.1\.0") {
        Write-Host "      OK - Gradle wrapper set to 9.1.0"
    } else {
        Write-Host "      ERROR - Failed to patch gradle-wrapper.properties"
        Write-Host "      Content: $(Get-Content $wrapperProps -Raw)"
    }
} else {
    Write-Host "      WARN - gradle-wrapper.properties not found, skipping."
}

# ── Step 7: Run the post-sync patcher ────────────────────────────────────────
Write-Host ""
Write-Host "[7/10] Running post-sync patcher..."
node scripts/fix-proguard.cjs
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: fix-proguard.cjs failed."; exit 1 }

# ── Step 7: Lock Gradle JDK in gradle.properties ─────────────────────────────
Write-Host ""
Write-Host "[8/10] Locking Gradle JDK..."
$gradleProps = "android\gradle.properties"

if (Test-Path $gradleProps) {
    $content = Get-Content $gradleProps -Raw

    # Strip any existing org.gradle.java.home line
    $content = [regex]::Replace($content, "(?m)^org\.gradle\.java\.home=.*\r?\n?", "")

    # Find JAVA_HOME
    $javaHome = [System.Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
    if (-not $javaHome) {
        $javaHome = [System.Environment]::GetEnvironmentVariable("JAVA_HOME", "User")
    }
    if (-not $javaHome) {
        $javaCmd = Get-Command java -ErrorAction SilentlyContinue
        if ($javaCmd) {
            $javaHome = Split-Path (Split-Path $javaCmd.Source)
        }
    }

    if ($javaHome) {
        $javaHomeForGradle = $javaHome.Replace("\", "/")
        $newContent = $content.TrimEnd() + "`norg.gradle.java.home=$javaHomeForGradle`n"
        Set-Content -Path $gradleProps -Value $newContent -NoNewline
        Write-Host "      OK - Gradle JDK locked to: $javaHome"
    } else {
        Write-Host "      WARN - JAVA_HOME not set. Open Android Studio and set it under:"
        Write-Host "             File, Project Structure, SDK Location, Gradle JDK"
    }
} else {
    Write-Host "      WARN - gradle.properties not found, skipping JDK lock."
}

# ── Step 8: Validate no Lovable URLs leaked ───────────────────────────────────
Write-Host ""
Write-Host "[9/10] Scanning for Lovable URL leaks..."

$leakPatterns = @("lovableproject.com", "lovable.app", "hobby-shelf-spark", "ddfslywz")
$leakFound = $false

$filesToScan = @(
    "android\app\src\main\res\values\strings.xml",
    "android\capacitor.settings.gradle",
    "android\app\build.gradle"
)

foreach ($file in $filesToScan) {
    if (Test-Path $file) {
        $fileContent = Get-Content $file -Raw
        foreach ($pattern in $leakPatterns) {
            if ($fileContent -match [regex]::Escape($pattern)) {
                Write-Host "      ERROR - Leak found in: $file ($pattern)"
                $leakFound = $true
            }
        }
    }
}

if ($leakFound) {
    Write-Host "      Some Lovable URLs still present. Review output above."
} else {
    Write-Host "      OK - No Lovable URL leaks detected."
}

# ── Step 10: Extract SHA fingerprints from keystore ──────────────────────────
Write-Host ""
Write-Host "[10/10] Extracting SHA certificate fingerprints..."

$keystorePath = "gametaverns-release.keystore"
$keystoreAlias = "gametaverns"

# Check common locations
$keystoreLocations = @(
    (Join-Path $PSScriptRoot "..\$keystorePath"),
    (Join-Path $PSScriptRoot "..\android\$keystorePath"),
    (Join-Path ([Environment]::GetFolderPath("UserProfile")) ".android\$keystorePath"),
    (Join-Path ([Environment]::GetFolderPath("UserProfile")) "$keystorePath")
)

$foundKeystore = $null
foreach ($loc in $keystoreLocations) {
    if (Test-Path $loc) {
        $foundKeystore = (Resolve-Path $loc).Path
        break
    }
}

if ($foundKeystore) {
    Write-Host "      Found keystore: $foundKeystore"
    Write-Host ""
    try {
        $keytoolOutput = & keytool -list -v -keystore $foundKeystore -alias $keystoreAlias 2>&1
        $sha1Line = ($keytoolOutput | Select-String "SHA1:") -replace "^\s*SHA1:\s*", ""
        $sha256Line = ($keytoolOutput | Select-String "SHA256:") -replace "^\s*SHA256:\s*", ""

        if ($sha1Line) {
            Write-Host "      SHA-1  : $sha1Line"
        } else {
            Write-Host "      WARN - Could not extract SHA-1. Try running keytool manually:"
            Write-Host "             keytool -list -v -keystore $foundKeystore -alias $keystoreAlias"
        }
        if ($sha256Line) {
            Write-Host "      SHA-256: $sha256Line"
        } else {
            Write-Host "      WARN - Could not extract SHA-256."
        }

        Write-Host ""
        Write-Host "      Add these fingerprints to Firebase Console:"
        Write-Host "        Project Settings > Android app > SHA certificate fingerprints"
    } catch {
        Write-Host "      WARN - keytool failed: $_"
        Write-Host "      Make sure keytool is in your PATH (included with JDK)."
        Write-Host "      Manual command: keytool -list -v -keystore $foundKeystore -alias $keystoreAlias"
    }
} else {
    Write-Host "      WARN - No keystore found. Searched:"
    foreach ($loc in $keystoreLocations) {
        Write-Host "               $loc"
    }
    Write-Host "      Fingerprints are needed for Firebase push notifications."
    Write-Host "      If you have a keystore elsewhere, run:"
    Write-Host "        keytool -list -v -keystore <path> -alias $keystoreAlias"

    # Also try debug keystore as fallback
    $debugKeystore = Join-Path ([Environment]::GetFolderPath("UserProfile")) ".android\debug.keystore"
    if (Test-Path $debugKeystore) {
        Write-Host ""
        Write-Host "      Found DEBUG keystore — extracting debug fingerprints:"
        try {
            $debugOutput = & keytool -list -v -keystore $debugKeystore -alias androiddebugkey -storepass android 2>&1
            $debugSha1 = ($debugOutput | Select-String "SHA1:") -replace "^\s*SHA1:\s*", ""
            $debugSha256 = ($debugOutput | Select-String "SHA256:") -replace "^\s*SHA256:\s*", ""
            if ($debugSha1) { Write-Host "      DEBUG SHA-1  : $debugSha1" }
            if ($debugSha256) { Write-Host "      DEBUG SHA-256: $debugSha256" }
        } catch {
            Write-Host "      Could not read debug keystore: $_"
        }
    }
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================"
Write-Host "  BUILD COMPLETE"
Write-Host "  Next: npx cap open android"
Write-Host "  Then click Run to push to your device."
Write-Host "============================================================"
Write-Host ""
