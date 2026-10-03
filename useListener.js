import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  IDLE_RESET_MS,
  MAX_UTTERANCE_MS,
  MIN_SPEECH_MS,
  SILENCE_MS,
  VOICE_THRESHOLD_DB,
} from './config';

// Small mono AAC files: plenty for speech recognition and fast to upload.
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
};

/**
 * Always-on listening. Records continuously, cuts the audio into utterances by detecting
 * speech and silence, and hands each utterance file to `onUtterance(uri)`.
 * Call pause() while Jarvis is speaking so he does not hear himself, then resume().
 */
export function useListener(onUtterance) {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recState = useAudioRecorderState(recorder, 150);

  const stateRef = useRef(recState);
  stateRef.current = recState;
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const activeRef = useRef(false); // user turned listening on
  const pausedRef = useRef(false); // temporarily paused (Jarvis talking)
  const busyRef = useRef(false); // a start/stop is in flight
  const timerRef = useRef(null);
  const seg = useRef({ startedAt: 0, speaking: false, speechStart: 0, lastVoice: 0 });

  const [listening, setListening] = useState(false);

  const beginSegment = useCallback(async () => {
    if (!activeRef.current || pausedRef.current) return;
    await recorder.prepareToRecordAsync();
    recorder.record();
    const now = Date.now();
    seg.current = { startedAt: now, speaking: false, speechStart: 0, lastVoice: 0 };
  }, [recorder]);

  const endSegment = useCallback(
    async (deliver) => {
      const info = { ...seg.current };
      try {
        await recorder.stop();
      } catch {
        // already stopped
      }
      const uri = recorder.uri;
      const spokeFor = info.lastVoice - info.speechStart;
      if (deliver && uri && spokeFor >= MIN_SPEECH_MS) {
        try {
          onUtteranceRef.current?.(uri);
        } catch {
          // handler errors are shown by the app
        }
      }
    },
    [recorder]
  );

  const tick = useCallback(async () => {
    if (!activeRef.current || pausedRef.current || busyRef.current) return;
    const s = stateRef.current;
    if (!s?.isRecording) return;

    const now = Date.now();
    const level = typeof s.metering === 'number' ? s.metering : -160;
    const g = seg.current;

    if (level > VOICE_THRESHOLD_DB) {
      if (!g.speaking) {
        g.speaking = true;
        g.speechStart = now;
      }
      g.lastVoice = now;
    }

    const endOfSpeech = g.speaking && now - g.lastVoice > SILENCE_MS;
    const tooLong = g.speaking && now - g.speechStart > MAX_UTTERANCE_MS;
    const idleTooLong = !g.speaking && now - g.startedAt > IDLE_RESET_MS;

    if (endOfSpeech || tooLong || idleTooLong) {
      busyRef.current = true;
      try {
        await endSegment(endOfSpeech || tooLong);
        await beginSegment();
      } catch {
        // try again on the next tick
      } finally {
        busyRef.current = false;
      }
    }
  }, [beginSegment, endSegment]);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) throw new Error('Microphone permission is off. Enable it in iPhone Settings > Jarvis.');

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
    });
    activeRef.current = true;
    pausedRef.current = false;
    setListening(true);
    activateKeepAwakeAsync('jarvis').catch(() => {});

    busyRef.current = true;
    try {
      await beginSegment();
    } finally {
      busyRef.current = false;
    }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(tick, 150);
  }, [beginSegment, tick]);

  const stop = useCallback(async () => {
    activeRef.current = false;
    setListening(false);
    clearInterval(timerRef.current);
    timerRef.current = null;
    deactivateKeepAwake('jarvis');
    try {
      await recorder.stop();
    } catch {
      // not recording
    }
  }, [recorder]);

  const pause = useCallback(async () => {
    if (!activeRef.current) return;
    pausedRef.current = true;
    // wait for any in-flight start/stop before stopping the recorder
    for (let i = 0; i < 20 && busyRef.current; i++) await new Promise((r) => setTimeout(r, 50));
    try {
      await recorder.stop();
    } catch {
      // not recording
    }
  }, [recorder]);

  const resume = useCallback(async () => {
    if (!activeRef.current) return;
    pausedRef.current = false;
    busyRef.current = true;
    try {
      await beginSegment();
    } catch {
      // next tick will not retry; user can toggle listening
    } finally {
      busyRef.current = false;
    }
  }, [beginSegment]);

  useEffect(
    () => () => {
      activeRef.current = false;
      clearInterval(timerRef.current);
      deactivateKeepAwake('jarvis');
    },
    []
  );

  const level = typeof recState?.metering === 'number' ? recState.metering : -160;
  return { listening, level, start, stop, pause, resume };
}
