# Jarvis for iPhone (Expo / React Native)

A voice assistant for the iPhone 12 powered by Groq. Say **"Jarvis"** followed by a command:

- "Jarvis, google how tall is Mount Apo"
- "Jarvis, directions to SM City Cagayan de Oro" / "Jarvis, find coffee shops near me"
- "Jarvis, remind me to call Mom at 3:30 PM" / "remind me in 20 minutes to check the rice" / "remind me every day at 7 AM to take vitamins"
- "Jarvis, what reminders do I have?" / "Jarvis, clear all reminders"
- Anything else: normal conversation

**Important: your API key was pasted into a chat.** Treat it as exposed. Go to https://console.groq.com/keys, delete it, create a new one, and paste the new one into the app. The code never contains the key; you type it into the app once and it is stored in the iPhone Keychain.

## What "passive listening" can and cannot do on iPhone

- Jarvis listens continuously while the app is open and the screen is on (the app keeps the screen awake). He only reacts when he hears "Jarvis".
- iOS does not let third-party apps listen all day with the screen locked. A standalone build (Option B below) has the background-audio mode enabled and may keep listening for a while after you lock the phone, but iOS can stop it at any time. Expo Go (Option A) does not keep listening in the background.
- Each thing you say after a pause goes to Groq Whisper for transcription, so passive listening uses Groq requests and your free-tier rate limit. Only sound louder than the threshold is uploaded; silence is not.

## Requirements

- A computer (Windows or Mac) with **Node.js LTS** (https://nodejs.org) and **Visual Studio Code** (https://code.visualstudio.com)
- Your iPhone 12 on the same Wi-Fi as the computer
- **Expo Go** from the App Store on the iPhone
- A Groq API key (https://console.groq.com/keys)

## Fast path on a Mac: one command

Unzip `jarvis-app.zip`, open Terminal, then:

```
cd ~/Downloads/jarvis-app
bash install.sh
```

(Adjust the path if the unzipped folder is elsewhere.) It creates `~/jarvis`, installs everything, adds the Jarvis code and runs a check. When it finishes, skip to Step 3. On Windows, or if you prefer doing it by hand, use Steps 1 and 2.

## Step 1. Create the project (about 3 minutes)

Open a terminal (Windows: PowerShell. Mac: Terminal) and run these one at a time.

If you see `Need to install the following packages: create-expo-app ... Ok to proceed? (y)`, type just `y` and press Enter. Do not type the next command at that prompt.

```
npx create-expo-app@latest jarvis --template blank
cd jarvis
npx expo install expo-audio expo-speech expo-location expo-notifications expo-secure-store expo-web-browser expo-keep-awake
```

Check that the new `jarvis` folder contains a file called `App.js`. If it does not (some versions use a different default), run `npx create-expo-app@latest jarvis --template blank` again and make sure you choose the plain JavaScript "blank" template, not TypeScript or Expo Router.

`npx expo install` picks the package versions that match your Expo version, which is what keeps the app free of version errors.

## Step 2. Add the Jarvis code

From the zip you received, copy these into the `jarvis` folder:

1. `App.js` (replace the existing one)
2. the whole `src` folder
3. `apply-config.js`

Then, in the terminal inside the `jarvis` folder:

```
node apply-config.js
```

It prints `app.json updated for Jarvis.` This adds the microphone, location and notification permission text that iOS requires.

## Step 3. Open in Visual Studio Code

In the same terminal:

```
code .
```

(If `code` is not recognized: open VS Code, choose File > Open Folder, and select the `jarvis` folder.) Useful extensions: "Expo Tools" and "ES7+ React/Redux/React-Native snippets".

## Step 4. Check for problems

```
npx expo-doctor
```

Fix anything it reports before continuing (it normally prints that all checks passed).

## Step 5. Option A: run it on your iPhone with Expo Go (free, no Apple account)

```
npx expo start
```

1. A QR code appears in the terminal.
2. Open the iPhone **Camera** app and point it at the QR code. Tap the banner to open it in Expo Go.
3. If the phone cannot connect (corporate or campus Wi-Fi, VPN, or Windows firewall), stop the server with Ctrl+C and run `npx expo start --tunnel`. If it asks to install `@expo/ngrok`, answer `y`.
4. Allow **Microphone**, **Notifications** and **Location** when asked.
5. In the app, the Settings window opens on first launch. Paste your **new** Groq key and tap Save.
6. Tap the glowing orb. The status changes to `Listening for "Jarvis"…`. Say "Jarvis, remind me in two minutes to stretch."

To reopen later: run `npx expo start` again and scan the QR code. The app lives inside Expo Go and only works while your computer is serving it.

## Step 5. Option B: a real, standalone Jarvis app on the iPhone home screen

Apple requires a signing identity for this. Pick one:

**B1. You have a Mac with Xcode (free Apple ID works, the app expires after 7 days and must be reinstalled):**

```
npx expo install expo-dev-client
npx expo run:ios --device
```

Choose your iPhone when prompted. If Xcode asks for a team, open `ios/jarvis.xcworkspace`, select the project, go to Signing & Capabilities, and pick your Apple ID team. On the iPhone, trust the developer under Settings > General > VPN & Device Management.

**B2. No Mac, with a paid Apple Developer account ($99 per year), using Expo's cloud build:**

```
npm install -g eas-cli
eas login
eas build:configure
eas device:create
eas build --profile development --platform ios
```

`eas device:create` gives you a link or QR code to open on the iPhone to register it. When the build finishes, open the install link on the iPhone. Before building, edit `app.json` and change `com.yourname.jarvis` to your own unique identifier, for example `com.lyonmigs.jarvis`.

## How to tune it

All settings are in `src/config.js`:

- Jarvis ignores you or hears background noise: change `VOICE_THRESHOLD_DB`. A lower number (like -45) is more sensitive; a higher number (like -30) needs louder speech.
- He cuts you off mid-sentence: raise `SILENCE_MS` (for example 1500).
- Speaking Filipino or another language: change `SPEECH_LANGUAGE` (`'tl'` for Tagalog) or set it to `null` to auto-detect.
- Different voice model or chat model: `WHISPER_MODEL` and `CHAT_MODEL`.

## Troubleshooting

- **"Groq rejected the API key (401)"**: open Settings (top right) and paste a valid key.
- **"Groq rate limit reached (429)"**: you hit the free-tier limit. Wait a minute, or use the orb only when needed.
- **Jarvis never reacts**: check the log at the bottom of the screen. If nothing is logged, the threshold is too high. If errors appear, they say what went wrong. You can also type a command in the box at the bottom to test everything except the microphone.
- **No sound from Jarvis**: turn off the silent switch's effect by raising the volume; the app is set to play in silent mode.
- **Reminder did not fire**: iPhone Settings > Notifications > Jarvis (or Expo Go) must be allowed. Reminders are local notifications, so they fire even when the app is closed.
- **Maps/Google open and Jarvis stops listening**: Apple Maps leaves the app; return to Jarvis to resume. Google results open in an in-app browser; close it to continue.
- **Metro/Expo cache problems**: stop the server and run `npx expo start --clear`.

## Files

- `App.js`: screen, wake word flow, speaking
- `src/useListener.js`: always-on recording and speech/silence detection
- `src/groq.js`: Groq Whisper transcription and chat calls
- `src/brain.js`: turns what you said into an action (search, directions, reminder, chat)
- `src/actions.js`: opens Google, Apple Maps, and manages reminders
- `src/reminders.js`: local notification scheduling
- `src/secure.js`: Keychain storage for the API key
- `src/config.js`: wake words and tuning
- `apply-config.js`: one-time `app.json` setup
