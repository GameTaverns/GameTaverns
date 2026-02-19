#!/usr/bin/env node
/**
 * Patches Capacitor plugin build.gradle files to replace the deprecated
 * proguard-android.txt with proguard-android-optimize.txt.
 */
const fs = require('fs');
const path = require('path');

const plugins = [
  '@capacitor/core',
  '@capacitor/camera',
  '@capacitor/network',
  '@capacitor/preferences',
  '@capacitor/push-notifications',
  '@capacitor/splash-screen',
  '@capacitor/status-bar',
];

let patched = 0;
let skipped = 0;
let failed = 0;

for (const plugin of plugins) {
  const filePath = path.join(__dirname, '..', 'node_modules', plugin, 'android', 'build.gradle');
  console.log('Checking: ' + filePath);

  if (!fs.existsSync(filePath)) {
    console.log('  -> Not found, skipping.');
    skipped++;
    continue;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const updated = original.replace(
    /getDefaultProguardFile\('proguard-android\.txt'\)/g,
    "getDefaultProguardFile('proguard-android-optimize.txt')"
  );

  if (original === updated) {
    console.log('  -> Already patched.');
    skipped++;
  } else {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('  -> Patched successfully.');
    patched++;
  }
}

console.log('\nResult: Patched=' + patched + ' Skipped=' + skipped + ' Failed=' + failed);

if (failed > 0) {
  process.exit(1);
}
