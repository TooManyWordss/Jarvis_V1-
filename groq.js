import { CHAT_MODEL, SPEECH_LANGUAGE, WHISPER_MODEL } from './config';

const BASE = 'https://api.groq.com/openai/v1';

async function failure(res) {
  let detail = '';
  try {
    const data = await res.json();
    detail = data?.error?.message || JSON.stringify(data);
  } catch {
    detail = await res.text().catch(() => '');
  }
  if (res.status === 401) return 'Groq rejected the API key (401). Check it in Settings.';
  if (res.status === 429) return 'Groq rate limit reached (429). Wait a moment and try again.';
  return `Groq error ${res.status}: ${detail}`.slice(0, 300);
}

/** Speech to text with Groq Whisper. `uri` is a local .m4a file. */
export async function transcribe(apiKey, uri) {
  const form = new FormData();
  form.append('file', { uri, name: 'speech.m4a', type: 'audio/m4a' });
  form.append('model', WHISPER_MODEL);
  form.append('temperature', '0');
  form.append('response_format', 'json');
  form.append('prompt', 'Jarvis'); // nudges Whisper to spell the wake word correctly
  if (SPEECH_LANGUAGE) form.append('language', SPEECH_LANGUAGE);

  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(await failure(res));
  const data = await res.json();
  return (data.text || '').trim();
}

/** Chat completion that must answer with a JSON object. Returns the parsed object. */
export async function chatJSON(apiKey, messages) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(await failure(res));
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return { action: 'chat', speech: raw };
  }
}
