import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Location from 'expo-location';
import { clearReminders, listReminders, scheduleReminder } from './reminders';

const enc = encodeURIComponent;

function friendlyTime(date) {
  return date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * Turns the model's decision into something to say and (optionally) something to open afterwards.
 * Returns { speech: string, launch?: () => Promise<void> }
 */
export async function runAction(res) {
  const speech = (res.speech || '').toString().trim();

  switch (res.action) {
    case 'search': {
      const q = (res.query || '').toString().trim();
      if (!q) return { speech: speech || 'What should I search for?' };
      return {
        speech: speech || `Searching Google for ${q}.`,
        launch: () => WebBrowser.openBrowserAsync(`https://www.google.com/search?q=${enc(q)}`),
      };
    }

    case 'directions': {
      const dest = (res.destination || '').toString().trim();
      if (!dest) return { speech: speech || 'Where would you like to go?' };
      const mode = ['d', 'w', 'r'].includes(res.mode) ? res.mode : 'd';
      return {
        speech: speech || `Getting directions to ${dest}.`,
        launch: () => Linking.openURL(`http://maps.apple.com/?daddr=${enc(dest)}&dirflg=${mode}`),
      };
    }

    case 'nearby': {
      const q = (res.query || '').toString().trim();
      if (!q) return { speech: speech || 'What are you looking for nearby?' };
      let near = '';
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          near = `&sll=${pos.coords.latitude},${pos.coords.longitude}&z=14`;
        }
      } catch {
        // No location: Apple Maps will still search around the user's current area.
      }
      return {
        speech: speech || `Looking for ${q} near you.`,
        launch: () => Linking.openURL(`http://maps.apple.com/?q=${enc(q)}${near}`),
      };
    }

    case 'reminder': {
      try {
        const date = await scheduleReminder({
          title: (res.title || 'Reminder').toString(),
          when: res.when,
          repeat: res.repeat === 'daily' ? 'daily' : 'none',
        });
        const when = res.repeat === 'daily' ? `every day at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : friendlyTime(date);
        return { speech: speech || `Done. I will remind you ${when}.` };
      } catch (e) {
        return { speech: e.message };
      }
    }

    case 'list_reminders': {
      const items = await listReminders();
      if (!items.length) return { speech: 'You have no reminders set.' };
      const lines = items.slice(0, 5).map((r) => `${r.title}, ${r.when}`);
      const more = items.length > 5 ? ` and ${items.length - 5} more` : '';
      return { speech: `You have ${items.length} reminder${items.length > 1 ? 's' : ''}: ${lines.join('. ')}${more}.` };
    }

    case 'clear_reminders': {
      await clearReminders();
      return { speech: speech || 'All reminders cleared.' };
    }

    default:
      return { speech: speech || 'Sorry, I did not catch that.' };
  }
}
