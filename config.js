// Tunable settings for Jarvis. Nothing secret lives here.
// The Groq API key is entered inside the app (Settings) and stored in the iPhone Keychain.

// Whisper sometimes mishears the name, so a few close spellings also count as the wake word.
export const WAKE_REGEX = /\b(jarvis|jarvus|jarvas|jarviss|jervis|jarvi)\b[\s,.!?:-]*/i;

// Speech models / languages
export const WHISPER_MODEL = 'whisper-large-v3-turbo';
export const CHAT_MODEL = 'llama-3.3-70b-versatile';
export const SPEECH_LANGUAGE = 'en'; // ISO-639-1 code sent to Whisper. Set to null to auto-detect.

// Passive listening tuning (metering is in dB: about -60 = quiet room, -20..-5 = normal speech)
export const VOICE_THRESHOLD_DB = -38; // louder than this counts as "someone is speaking"
export const SILENCE_MS = 1100;        // this much quiet ends an utterance
export const MIN_SPEECH_MS = 450;      // ignore blips shorter than this (door slams, coughs)
export const MAX_UTTERANCE_MS = 14000; // hard cap per utterance
export const IDLE_RESET_MS = 30000;    // restart the recorder if nothing was said (keeps files tiny)
export const AWAKE_WINDOW_MS = 10000;  // after "Jarvis" alone, how long he waits for the command
