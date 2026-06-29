import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'drawtogether_token';
const USER_KEY = 'drawtogether_user';

export async function setToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  try { return await AsyncStorage.getItem(TOKEN_KEY); }
  catch { return null; }
}

export async function removeToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export function setUser(user: { id: string; email: string }) {
  AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getUser(): Promise<{ id: string; email: string } | null> {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export async function logout() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}
