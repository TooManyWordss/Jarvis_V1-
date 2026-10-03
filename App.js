import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';

import { AWAKE_WINDOW_MS, WAKE_REGEX } from './src/config';
import { getApiKey, saveApiKey } from './src/secure';
import { transcribe } from './src/groq';
import { think } from './src/brain';
import { runAction } from './src/actions';
import { ensureNotificationPermission } from './src/reminders';
import { useListener } from './src/useListener';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | listening | thinking | speaking
  const [typed, setTyped] = useState('');

  const apiKeyRef = useRef('');
  const historyRef = useRef([]);
  const awakeUntil = useRef(0);
  const queue = useRef(Promise.resolve());
  const listenerRef = useRef(null);
  const nextId = useRef(1);

  const addLog = useCallback((who, text) => {
    setLog((prev) => [{ id: String(nextId.current++), who, text }, ...prev].slice(0, 60));
  }, []);

  const say = useCallback(
    async (text) => {
      if (!text) return;
      addLog('jarvis', text);
      setStatus('speaking');
      await listenerRef.current?.pause();
      await new Promise((resolve) => {
        Speech.speak(text, {
          language: 'en-US',
          pitch: 0.95,
          rate: 1.0,
          onDone: resolve,
          onStopped: resolve,
          onError: resolve,
        });
      });
      await listenerRef.current?.resume();
      setStatus(listenerRef.current?.listening ? 'listening' : 'idle');
    },
    [addLog]
  );

  const runCommand = useCallback(
    async (text) => {
      addLog('you', text);
      setStatus('thinking');
      try {
        const decision = await think(apiKeyRef.current, text, historyRef.current);
        const { speech, launch } = await runAction(decision);
        historyRef.current.push({ role: 'user', content: text });
        historyRef.current.push({ role: 'assistant', content: speech });
        historyRef.current = historyRef.current.slice(-12);
        await say(speech);
        if (launch) await launch();
      } catch (e) {
        addLog('error', e.message || String(e));
        setStatus(listenerRef.current?.listening ? 'listening' : 'idle');
      }
    },
    [addLog, say]
  );

  const handleUtterance = useCallback(
    async (uri) => {
      if (!apiKeyRef.current) return;
      try {
        const text = await transcribe(apiKeyRef.current, uri);
        if (!text) return;

        const heardWakeWord = WAKE_REGEX.test(text);
        const awake = Date.now() < awakeUntil.current;
        if (!heardWakeWord && !awake) return; // passive mode: ignore everything else

        const command = text.replace(WAKE_REGEX, '').replace(/^[\s,.!?:-]+/, '').trim();
        if (command.length < 2) {
          awakeUntil.current = Date.now() + AWAKE_WINDOW_MS;
          await say('Yes?');
          return;
        }
        awakeUntil.current = 0;
        await runCommand(command);
      } catch (e) {
        addLog('error', e.message || String(e));
      }
    },
    [addLog, runCommand, say]
  );

  const listener = useListener((uri) => {
    // one utterance at a time, in order
    queue.current = queue.current.then(() => handleUtterance(uri)).catch(() => {});
  });
  listenerRef.current = listener;

  // Load the saved key; open Settings on first launch.
  useEffect(() => {
    (async () => {
      const saved = await getApiKey();
      if (saved) {
        setApiKey(saved);
        apiKeyRef.current = saved;
      } else {
        setShowSettings(true);
      }
      ensureNotificationPermission().catch(() => {});
    })();
  }, []);

  // Read reminders aloud when they fire while the app is open.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const body = n.request?.content?.body;
      if (body) say(`Reminder: ${body}`);
    });
    return () => sub.remove();
  }, [say]);

  const toggleListening = async () => {
    try {
      if (listener.listening) {
        await listener.stop();
        setStatus('idle');
      } else {
        if (!apiKeyRef.current) {
          setShowSettings(true);
          return;
        }
        await listener.start();
        setStatus('listening');
      }
    } catch (e) {
      addLog('error', e.message || String(e));
    }
  };

  const saveSettings = async () => {
    const value = keyDraft.trim();
    if (!value) return;
    await saveApiKey(value);
    setApiKey(value);
    apiKeyRef.current = value;
    setKeyDraft('');
    setShowSettings(false);
    addLog('jarvis', 'API key saved. Tap the orb and say "Jarvis" to begin.');
  };

  const sendTyped = () => {
    const text = typed.trim();
    if (!text) return;
    setTyped('');
    if (!apiKeyRef.current) {
      setShowSettings(true);
      return;
    }
    queue.current = queue.current.then(() => runCommand(text)).catch(() => {});
  };

  const scale = 1 + Math.max(0, Math.min(1, (listener.level + 60) / 60)) * 0.35;
  const statusText = {
    idle: '',
    listening: 'Listening for "Jarvis"…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
  }[status];

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>JARVIS</Text>
        <TouchableOpacity onPress={() => { setKeyDraft(''); setShowSettings(true); }}>
          <Text style={styles.gear}>Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.orbArea}>
        <TouchableOpacity activeOpacity={0.8} onPress={toggleListening}>
          <View
            style={[
              styles.orb,
              listener.listening && styles.orbOn,
              { transform: [{ scale: listener.listening ? scale : 1 }] },
            ]}
          />
        </TouchableOpacity>
        <Text style={styles.status}>{statusText}</Text>
      </View>

      <FlatList
        style={styles.log}
        data={log}
        inverted
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Text style={[styles.line, item.who === 'you' && styles.you, item.who === 'error' && styles.err]}>
            {item.who === 'you' ? 'You: ' : item.who === 'error' ? 'Error: ' : 'Jarvis: '}
            {item.text}
          </Text>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={typed}
          onChangeText={setTyped}
          placeholder="Or type a command…"
          placeholderTextColor="#6b7a90"
          onSubmitEditing={sendTyped}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.send} onPress={sendTyped}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalBack}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Groq API key</Text>
            <Text style={styles.modalHelp}>
              Paste your key from console.groq.com/keys. It is stored in the iPhone Keychain and only sent to Groq.
              {apiKey ? '\nA key is already saved. Paste a new one to replace it.' : ''}
            </Text>
            <TextInput
              style={styles.keyInput}
              value={keyDraft}
              onChangeText={setKeyDraft}
              placeholder="gsk_..."
              placeholderTextColor="#6b7a90"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              {apiKey ? (
                <TouchableOpacity onPress={() => setShowSettings(false)}>
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.save} onPress={saveSettings}>
                <Text style={styles.sendText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070b14', paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  title: { color: '#7fd6ff', fontSize: 22, fontWeight: '700', letterSpacing: 6 },
  gear: { color: '#9fb3c8', fontSize: 15 },
  orbArea: { alignItems: 'center', paddingVertical: 28 },
  orb: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#13233a', borderWidth: 2, borderColor: '#2c4a6e' },
  orbOn: { backgroundColor: '#0e7fb8', borderColor: '#7fd6ff' },
  status: { color: '#9fb3c8', marginTop: 18, fontSize: 15 },
  log: { flex: 1, paddingHorizontal: 20 },
  line: { color: '#d8e6f5', fontSize: 15, marginVertical: 5, lineHeight: 21 },
  you: { color: '#7fd6ff' },
  err: { color: '#ff8a8a' },
  inputRow: { flexDirection: 'row', padding: 14, paddingBottom: 30, gap: 10 },
  input: { flex: 1, backgroundColor: '#101a2b', color: '#fff', borderRadius: 10, paddingHorizontal: 14, height: 44 },
  send: { backgroundColor: '#0e7fb8', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '600' },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#101a2b', borderRadius: 16, padding: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalHelp: { color: '#9fb3c8', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  keyInput: { backgroundColor: '#070b14', color: '#fff', borderRadius: 10, paddingHorizontal: 14, height: 44 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 18, marginTop: 16 },
  cancel: { color: '#9fb3c8', fontSize: 15 },
  save: { backgroundColor: '#0e7fb8', borderRadius: 10, paddingHorizontal: 22, paddingVertical: 11 },
});
