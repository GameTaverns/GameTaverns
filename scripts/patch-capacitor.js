#!/usr/bin/env node
/**
 * Patches Capacitor plugin build.gradle files to replace the deprecated
 * proguard-android.txt with proguard-android-optimize.txt.
 * Run automatically via postinstall, or manually with: node scripts/patch-capacitor.js
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

try {
  let patched = 0;
  let skipped = 0;

  for (const plugin of plugins) {
    try {
      const filePath = path.join(__dirname, '..', 'node_modules', plugin, 'android', 'build.gradle');

      if (!fs.existsSync(filePath)) {
        console.log('Skipping ' + plugin + ' - file not found');
        skipped++;
        continue;
      }

      const original = fs.readFileSync(filePath, 'utf8');
      const updated = original.replace(
        /getDefaultProguardFile\('proguard-android\.txt'\)/g,
        "getDefaultProguardFile('proguard-android-optimize.txt')"
      );

      if (original === updated) {
        console.log(plugin + ' - already patched');
        skipped++;
      } else {
        fs.writeFileSync(filePath, updated, 'utf8');
        console.log(plugin + ' - patched successfully');
        patched++;
      }
    } catch (e) {
      console.log('Could not patch ' + plugin + ': ' + e.message);
    }
  }

  console.log('Done. Patched: ' + patched + ', Skipped: ' + skipped);
} catch (e) {
  console.log('Patch script warning: ' + e.message);
}

// Always exit cleanly so npm install is never blocked
process.exit(0);
