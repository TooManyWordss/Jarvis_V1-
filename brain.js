import { chatJSON } from './groq';

function localISO(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

function systemPrompt() {
  const now = new Date();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
  return `You are Jarvis, a calm, quick-witted voice assistant living on the user's iPhone.
Current local date and time: ${localISO(now)} (${now.toDateString()}), time zone ${zone}.

Decide what the user wants and answer ONLY with one JSON object, no other text:
{
  "action": "chat" | "search" | "directions" | "nearby" | "reminder" | "list_reminders" | "clear_reminders",
  "speech": "what you say out loud: at most two short sentences, plain words, no markdown",
  "query": "for search: the Google query. For nearby: what to find, e.g. 'coffee shop'",
  "destination": "for directions: the place or address",
  "mode": "for directions: 'd' driving, 'w' walking or 'r' transit (default 'd')",
  "title": "for reminder: what to remind the user about, short",
  "when": "for reminder: ISO-8601 local time WITH offset, e.g. 2026-10-02T15:30:00+08:00",
  "repeat": "for reminder: 'none' or 'daily'"
}

Rules:
- "search": the user says google/search/look up something, or needs live info you cannot know.
- "directions": navigate or get directions to a place. "nearby": find places near the user.
- "reminder": remind, alarm, schedule, wake me. Work out the exact "when" from the current time above.
  If the user gives only a time with no date, use the next time it occurs. If no time is given, set action to "chat" and ask for the time.
  "in 10 minutes" means current time plus 10 minutes. "every day at 7" means repeat "daily".
- "chat": everything else. Answer helpfully and briefly in "speech".
- Always fill "speech" with a natural confirmation, for example "Okay, I will remind you to call Mom at 3:30 PM."`;
}

/** history: [{role:'user'|'assistant', content:string}] (most recent last) */
export async function think(apiKey, userText, history = []) {
  const messages = [
    { role: 'system', content: systemPrompt() },
    ...history.slice(-6),
    { role: 'user', content: userText },
  ];
  const result = await chatJSON(apiKey, messages);
  if (!result || typeof result !== 'object') return { action: 'chat', speech: 'Sorry, I lost my train of thought.' };
  return result;
}
