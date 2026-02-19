/**
 * Fixes the proguard-android.txt → proguard-android-optimize.txt reference
 * in android/app/build.gradle after every `npx cap sync`.
 * Run via: node scripts/fix-proguard.js
 */
const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

if (!fs.existsSync(buildGradlePath)) {
  console.log('android/app/build.gradle not found — skipping proguard fix.');
  process.exit(0);
}

let content = fs.readFileSync(buildGradlePath, 'utf8');

const original = "getDefaultProguardFile('proguard-android.txt')";
const fixed    = "getDefaultProguardFile('proguard-android-optimize.txt')";

if (content.includes(original)) {
  content = content.replaceAll(original, fixed);
  fs.writeFileSync(buildGradlePath, content, 'utf8');
  console.log('✅ Proguard fix applied to android/app/build.gradle');
} else {
  console.log('ℹ️  Proguard already correct — no changes needed.');
}
