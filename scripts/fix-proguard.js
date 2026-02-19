/**
 * Post-cap-sync patch script.
 * Run after every `npx cap sync android` to fix two issues:
 * 
 * 1. proguard-android.txt → proguard-android-optimize.txt in build.gradle
 * 2. Remove any stale Lovable preview server URL from capacitor.settings.gradle / strings.xml
 *
 * Usage: node scripts/fix-proguard.js
 */
const fs = require('fs');
const path = require('path');

const androidDir = path.join(__dirname, '..', 'android');

// ─── Fix 1: ProGuard reference ───────────────────────────────────────────────
const buildGradlePath = path.join(androidDir, 'app', 'build.gradle');

if (fs.existsSync(buildGradlePath)) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');
  const original = "getDefaultProguardFile('proguard-android.txt')";
  const fixed    = "getDefaultProguardFile('proguard-android-optimize.txt')";
  if (content.includes(original)) {
    content = content.replaceAll(original, fixed);
    fs.writeFileSync(buildGradlePath, content, 'utf8');
    console.log('✅ ProGuard fix applied to android/app/build.gradle');
  } else {
    console.log('ℹ️  ProGuard already correct — no changes needed.');
  }
} else {
  console.log('⚠️  android/app/build.gradle not found — skipping ProGuard fix.');
}

// ─── Fix 2: Strip Lovable server URL from Capacitor-generated strings ─────────
// Capacitor writes the server URL (if set) into android/app/src/main/res/values/strings.xml
const stringsXmlPath = path.join(androidDir, 'app', 'src', 'main', 'res', 'values', 'strings.xml');

if (fs.existsSync(stringsXmlPath)) {
  let xmlContent = fs.readFileSync(stringsXmlPath, 'utf8');
  const lovablePattern = /(lovableproject\.com|lovable\.app|hobby-shelf-spark)/gi;
  if (lovablePattern.test(xmlContent)) {
    // Remove the entire capacitor_server_path line that contains a Lovable URL
    xmlContent = xmlContent.replace(
      /<string name="capacitor_server_path">[^<]*(lovableproject\.com|lovable\.app|hobby-shelf-spark)[^<]*<\/string>\n?/gi,
      ''
    );
    fs.writeFileSync(stringsXmlPath, xmlContent, 'utf8');
    console.log('✅ Removed Lovable server URL from android strings.xml');
  } else {
    console.log('ℹ️  No Lovable URLs found in strings.xml — OK.');
  }
} else {
  console.log('ℹ️  strings.xml not found yet — run npx cap sync first.');
}

// ─── Fix 3: Check capacitor.settings.gradle for stale references ─────────────
const settingsGradlePath = path.join(androidDir, 'capacitor.settings.gradle');
if (fs.existsSync(settingsGradlePath)) {
  const sg = fs.readFileSync(settingsGradlePath, 'utf8');
  if (/(lovableproject\.com|lovable\.app|hobby-shelf-spark)/gi.test(sg)) {
    console.warn('⚠️  WARNING: Lovable URL found in capacitor.settings.gradle — you may need to re-run npx cap init with the correct config.');
  } else {
    console.log('ℹ️  capacitor.settings.gradle looks clean.');
  }
}

console.log('\n✅ All patches applied. Safe to open in Android Studio.');
