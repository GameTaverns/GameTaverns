/**
 * GameTaverns — Post-Cap-Sync Patcher
 * App ID: com.gametaverns.app
 * Backend: https://gametaverns.com
 *
 * Run after EVERY `npx cap sync android`.
 * Also called automatically by scripts/android-setup.ps1.
 *
 * What this does:
 *  1. Fix ProGuard reference in android/app/build.gradle
 *  2. Patch ProGuard in all Capacitor plugin build.gradle files (node_modules)
 *  3. Strip any Lovable/preview URLs from strings.xml
 *  4. Validate capacitor.settings.gradle is clean
 *  5. Hardcode gt-logo.png as the launcher icon in all mipmap folders
 *  6. Write correct applicationId (com.gametaverns.app) into build.gradle
 *
 * Usage: node scripts/fix-proguard.js
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const ANDROID    = path.join(ROOT, 'android');
const APP_ID     = 'com.gametaverns.app';
const APP_NAME   = 'GameTaverns';
const BACKEND    = 'https://gametaverns.com';

// Patterns that must NEVER appear in native files
const LOVABLE_PATTERNS = [
  /lovableproject\.com/gi,
  /lovable\.app/gi,
  /hobby-shelf-spark/gi,
  /ddfslywz/gi,           // Lovable Cloud Supabase project ID
];

let errors = 0;
function warn(msg)  { console.warn('  ⚠️  ' + msg); }
function ok(msg)    { console.log( '  ✅ ' + msg); }
function info(msg)  { console.log( '  ℹ️  ' + msg); }
function fail(msg)  { console.error('  ❌ ' + msg); errors++; }

function containsLovable(content) {
  return LOVABLE_PATTERNS.some(p => { p.lastIndex = 0; return p.test(content); });
}

function stripLovableUrls(content) {
  // Remove entire <string> tags that contain Lovable URLs
  return content.replace(
    /<string name="[^"]*">[^<]*(lovableproject\.com|lovable\.app|hobby-shelf-spark|ddfslywz)[^<]*<\/string>\n?/gi,
    ''
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('');
console.log('====================================================');
console.log('  GameTaverns Post-Sync Patcher');
console.log('  App ID : ' + APP_ID);
console.log('  Backend: ' + BACKEND);
console.log('====================================================');
console.log('');

if (!fs.existsSync(ANDROID)) {
  fail('android/ folder not found. Run `npx cap add android` first.');
  process.exit(1);
}

// ─── Fix 1: ProGuard in android/app/build.gradle ─────────────────────────────
console.log('[1/6] Fixing ProGuard in android/app/build.gradle...');
const appBuildGradle = path.join(ANDROID, 'app', 'build.gradle');

if (fs.existsSync(appBuildGradle)) {
  let content = fs.readFileSync(appBuildGradle, 'utf8');
  const before = content;

  // Fix proguard reference
  content = content.replaceAll(
    "getDefaultProguardFile('proguard-android.txt')",
    "getDefaultProguardFile('proguard-android-optimize.txt')"
  );

  // Ensure applicationId is correct
  if (content.includes('applicationId') && !content.includes(`applicationId "${APP_ID}"`)) {
    content = content.replace(
      /applicationId\s+"[^"]*"/,
      `applicationId "${APP_ID}"`
    );
    info('applicationId corrected to ' + APP_ID);
  }

  if (content !== before) {
    fs.writeFileSync(appBuildGradle, content, 'utf8');
    ok('android/app/build.gradle patched.');
  } else {
    info('android/app/build.gradle already correct.');
  }
} else {
  warn('android/app/build.gradle not found — skipping.');
}

// ─── Fix 2: ProGuard in Capacitor plugin build.gradle files ──────────────────
console.log('');
console.log('[2/6] Fixing ProGuard in Capacitor plugin node_modules...');
const plugins = [
  '@capacitor/core',
  '@capacitor/camera',
  '@capacitor/network',
  '@capacitor/preferences',
  '@capacitor/push-notifications',
  '@capacitor/splash-screen',
  '@capacitor/status-bar',
];

let pluginPatched = 0;
for (const plugin of plugins) {
  const pluginGradle = path.join(ROOT, 'node_modules', plugin, 'android', 'build.gradle');
  if (!fs.existsSync(pluginGradle)) continue;

  const original = fs.readFileSync(pluginGradle, 'utf8');
  const updated  = original.replace(
    /getDefaultProguardFile\('proguard-android\.txt'\)/g,
    "getDefaultProguardFile('proguard-android-optimize.txt')"
  );

  if (original !== updated) {
    fs.writeFileSync(pluginGradle, updated, 'utf8');
    pluginPatched++;
  }
}
ok(`${pluginPatched} plugin build.gradle file(s) patched.`);

// ─── Fix 3: Strip Lovable URLs from strings.xml ───────────────────────────────
console.log('');
console.log('[3/6] Sanitizing android/app/src/main/res/values/strings.xml...');
const stringsXml = path.join(ANDROID, 'app', 'src', 'main', 'res', 'values', 'strings.xml');

if (fs.existsSync(stringsXml)) {
  let xml = fs.readFileSync(stringsXml, 'utf8');

  if (containsLovable(xml)) {
    xml = stripLovableUrls(xml);
    // Double-check
    if (containsLovable(xml)) {
      fail('strings.xml still contains Lovable URLs after sanitization — manual review required.');
    } else {
      fs.writeFileSync(stringsXml, xml, 'utf8');
      ok('Lovable URLs removed from strings.xml.');
    }
  } else {
    ok('strings.xml is clean.');
  }

  // Also verify app_name is correct
  if (!xml.includes(`>${APP_NAME}<`)) {
    xml = xml.replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">${APP_NAME}</string>`);
    fs.writeFileSync(stringsXml, xml, 'utf8');
    ok('app_name set to ' + APP_NAME);
  }
} else {
  warn('strings.xml not found — run `npx cap sync android` first.');
}

// ─── Fix 4: Validate capacitor.settings.gradle ───────────────────────────────
console.log('');
console.log('[4/6] Validating capacitor.settings.gradle...');
const settingsGradle = path.join(ANDROID, 'capacitor.settings.gradle');

if (fs.existsSync(settingsGradle)) {
  const sg = fs.readFileSync(settingsGradle, 'utf8');
  if (containsLovable(sg)) {
    fail('Lovable URL found in capacitor.settings.gradle — delete the android/ folder and re-run android-setup.ps1.');
  } else {
    ok('capacitor.settings.gradle is clean.');
  }
} else {
  warn('capacitor.settings.gradle not found — this is OK on a fresh add.');
}

// ─── Fix 5: Hardcode gt-logo.png as launcher icon ────────────────────────────
console.log('');
console.log('[5/6] Copying gt-logo.png to all mipmap icon slots...');
const sourceIcon = path.join(ROOT, 'public', 'gt-logo.png');

const mipmapFolders = [
  'mipmap-mdpi',
  'mipmap-hdpi',
  'mipmap-xhdpi',
  'mipmap-xxhdpi',
  'mipmap-xxxhdpi',
];

// Every icon slot Android uses
const iconTargets = [
  'ic_launcher.png',
  'ic_launcher_round.png',
  'ic_launcher_foreground.png',
];

if (!fs.existsSync(sourceIcon)) {
  warn('public/gt-logo.png not found — skipping icon copy.');
} else {
  let copied = 0;
  let missingDirs = 0;

  for (const folder of mipmapFolders) {
    const dir = path.join(ANDROID, 'app', 'src', 'main', 'res', folder);
    if (!fs.existsSync(dir)) { missingDirs++; continue; }

    for (const target of iconTargets) {
      const dest = path.join(dir, target);
      try {
        fs.copyFileSync(sourceIcon, dest); // Always overwrite unconditionally
        copied++;
      } catch (err) {
        warn(`Could not copy to ${dest}: ${err.message}`);
      }
    }
  }

  if (missingDirs === mipmapFolders.length) {
    warn('No mipmap folders found — run `npx cap add android` then re-run this script.');
  } else {
    ok(`gt-logo.png written to ${copied} mipmap icon slot(s).`);
  }
}

// ─── Fix 6: Final leak scan ───────────────────────────────────────────────────
console.log('');
console.log('[6/6] Final Lovable URL leak scan...');

const filesToScan = [
  path.join(ANDROID, 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
  path.join(ANDROID, 'capacitor.settings.gradle'),
  path.join(ANDROID, 'app', 'build.gradle'),
  path.join(ANDROID, 'build.gradle'),
];

let leaksFound = 0;
for (const f of filesToScan) {
  if (!fs.existsSync(f)) continue;
  const c = fs.readFileSync(f, 'utf8');
  if (containsLovable(c)) {
    fail(`Lovable URL still present in: ${path.relative(ROOT, f)}`);
    leaksFound++;
  }
}

if (leaksFound === 0) {
  ok('No Lovable URL leaks detected in native files.');
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
console.log('====================================================');
if (errors > 0) {
  console.error(`  DONE WITH ${errors} ERROR(S) — review output above.`);
  process.exit(1);
} else {
  console.log('  ✅ All patches applied. Safe to open Android Studio.');
  console.log('     npx cap open android');
}
console.log('====================================================');
console.log('');
