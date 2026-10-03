#!/usr/bin/env bash
# One-command setup for Mac/Linux. Run from the unzipped jarvis-app folder:
#   bash install.sh
# Creates ~/jarvis (a ready Expo project with the Jarvis code) and checks it.
set -e

SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/jarvis"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org, then run this again."
  exit 1
fi

if [ -e "$TARGET" ]; then
  echo "$TARGET already exists."
  echo "Rename or delete it (for example: mv ~/jarvis ~/jarvis-old) and run this again."
  exit 1
fi

cd "$HOME"
echo "== 1/4 Creating the Expo project in $TARGET"
npx --yes create-expo-app@latest jarvis --template blank

cd "$TARGET"
if [ ! -f App.js ]; then
  echo "The Expo template did not create App.js, so the Jarvis files cannot replace it."
  echo "Delete $TARGET and tell Claude what 'ls ~/jarvis' shows."
  exit 1
fi

echo "== 2/4 Installing packages (versions matched to your Expo version)"
npx expo install expo-audio expo-speech expo-location expo-notifications expo-secure-store expo-web-browser expo-keep-awake

echo "== 3/4 Adding the Jarvis code"
cp "$SRC/App.js" App.js
rm -rf src
cp -R "$SRC/src" src
cp "$SRC/apply-config.js" apply-config.js
node apply-config.js

echo "== 4/4 Checking the project"
npx expo-doctor || echo "(expo-doctor reported something. Send me the output if the app misbehaves.)"

echo
echo "Done. Next:"
echo "  cd ~/jarvis"
echo "  code .            # opens Visual Studio Code"
echo "  npx expo start    # then scan the QR code with the iPhone Camera"
