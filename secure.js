import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'jarvis_groq_api_key';

export async function getApiKey() {
  try {
    return (await SecureStore.getItemAsync(KEY_NAME)) || '';
  } catch {
    return '';
  }
}

export async function saveApiKey(value) {
  await SecureStore.setItemAsync(KEY_NAME, value.trim());
}

export async function clearApiKey() {
  await SecureStore.deleteItemAsync(KEY_NAME);
}
