import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return !!asked.granted;
}

/**
 * Schedules a local reminder.
 * @param {{title: string, when: string, repeat?: 'none'|'daily'}} r  `when` is ISO-8601 with offset.
 */
export async function scheduleReminder({ title, when, repeat = 'none' }) {
  const ok = await ensureNotificationPermission();
  if (!ok) throw new Error('Notifications are turned off for Jarvis. Enable them in iPhone Settings.');

  const date = new Date(when);
  if (Number.isNaN(date.getTime())) throw new Error('I could not work out the time for that reminder.');

  let trigger;
  if (repeat === 'daily') {
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  } else {
    if (date.getTime() <= Date.now() + 1000) throw new Error('That time has already passed.');
    trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date };
  }

  await Notifications.scheduleNotificationAsync({
    // `data` carries our own copy of the schedule so listing never depends on how iOS reports triggers.
    content: { title: 'Jarvis reminder', body: title, sound: true, data: { when: date.toISOString(), repeat } },
    trigger,
  });
  return date;
}

export async function listReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.map((n) => {
    const d = n.content?.data || {};
    const date = d.when ? new Date(d.when) : null;
    let when = '';
    if (date && !Number.isNaN(date.getTime())) {
      when =
        d.repeat === 'daily'
          ? `every day at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    }
    return { title: n.content?.body || '', when };
  });
}

export async function clearReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
