// Run once, from the project root, after creating the Expo project:  node apply-config.js
// Adds the iPhone permission texts, plugins and background-audio mode to app.json.
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app.json');
if (!fs.existsSync(file)) {
  console.error('app.json not found. Run this from inside the project folder (the one that contains App.js).');
  process.exit(1);
}

const json = JSON.parse(fs.readFileSync(file, 'utf8'));
const expo = json.expo || (json.expo = {});

expo.name = 'Jarvis';
expo.ios = expo.ios || {};
expo.ios.supportsTablet = false;
expo.ios.bundleIdentifier = expo.ios.bundleIdentifier || 'com.yourname.jarvis'; // change "yourname" before a real build
expo.ios.infoPlist = Object.assign({}, expo.ios.infoPlist, {
  NSMicrophoneUsageDescription: 'Jarvis listens for your voice commands.',
  NSLocationWhenInUseUsageDescription: 'Jarvis uses your location to find places and directions near you.',
  UIBackgroundModes: ['audio'],
});

const wanted = [
  ['expo-audio', { microphonePermission: 'Jarvis listens for your voice commands.' }],
  ['expo-location', { locationWhenInUsePermission: 'Jarvis uses your location to find places and directions near you.' }],
  'expo-notifications',
  'expo-secure-store',
];
expo.plugins = expo.plugins || [];
const nameOf = (p) => (Array.isArray(p) ? p[0] : p);
for (const plugin of wanted) {
  const idx = expo.plugins.findIndex((p) => nameOf(p) === nameOf(plugin));
  if (idx === -1) expo.plugins.push(plugin);
  else expo.plugins[idx] = plugin;
}

fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
console.log('app.json updated for Jarvis.');
