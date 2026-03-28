import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  TOKEN: 'rv_account_token',
  REFRESH_TOKEN: 'rv_account_refresh_token',
  USER_ID: 'rv_account_user_id',
  USER_EMAIL: 'rv_account_user_email',
  USER_NAME: 'rv_account_user_name',
  USER_PLAN: 'rv_account_user_plan',
  USER_TRIAL_ENDS_AT: 'rv_account_user_trial_ends_at',
  USER_CREATED_AT: 'rv_account_user_created_at',
} as const;

export interface AccountSessionUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  trialEndsAt: string | null;
  createdAt: string;
}

export interface AccountSession {
  token: string;
  refreshToken: string;
  user: AccountSessionUser;
}

let secureStoreAvailable: boolean | null = null;

async function isSecureStoreAvailable(): Promise<boolean> {
  if (secureStoreAvailable !== null) {
    return secureStoreAvailable;
  }

  if (Platform.OS === 'web') {
    secureStoreAvailable = false;
    return false;
  }

  try {
    await SecureStore.getItemAsync('__test_account_session__');
    secureStoreAvailable = true;
    return true;
  } catch {
    secureStoreAvailable = false;
    return false;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.setItemAsync(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (await isSecureStoreAvailable()) {
    return SecureStore.getItemAsync(key);
  }

  return AsyncStorage.getItem(key);
}

async function deleteItem(key: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

export async function persistAccountSession(session: AccountSession): Promise<void> {
  await Promise.all([
    setItem(STORAGE_KEYS.TOKEN, session.token),
    setItem(STORAGE_KEYS.REFRESH_TOKEN, session.refreshToken),
    setItem(STORAGE_KEYS.USER_ID, session.user.id),
    setItem(STORAGE_KEYS.USER_EMAIL, session.user.email),
    setItem(STORAGE_KEYS.USER_NAME, session.user.name),
    setItem(STORAGE_KEYS.USER_PLAN, session.user.plan),
    setItem(STORAGE_KEYS.USER_CREATED_AT, session.user.createdAt),
    setItem(STORAGE_KEYS.USER_TRIAL_ENDS_AT, session.user.trialEndsAt ?? ''),
  ]);
}

export async function restoreAccountSession(): Promise<AccountSession | null> {
  const [token, refreshToken, userId, email, name, plan, createdAt, trialEndsAt] = await Promise.all([
    getItem(STORAGE_KEYS.TOKEN),
    getItem(STORAGE_KEYS.REFRESH_TOKEN),
    getItem(STORAGE_KEYS.USER_ID),
    getItem(STORAGE_KEYS.USER_EMAIL),
    getItem(STORAGE_KEYS.USER_NAME),
    getItem(STORAGE_KEYS.USER_PLAN),
    getItem(STORAGE_KEYS.USER_CREATED_AT),
    getItem(STORAGE_KEYS.USER_TRIAL_ENDS_AT),
  ]);

  if (!token || !refreshToken || !userId || !email || !name || !plan || !createdAt) {
    return null;
  }

  return {
    token,
    refreshToken,
    user: {
      id: userId,
      email,
      name,
      plan,
      createdAt,
      trialEndsAt: trialEndsAt || null,
    },
  };
}

export async function clearAccountSession(): Promise<void> {
  await Promise.all([
    deleteItem(STORAGE_KEYS.TOKEN),
    deleteItem(STORAGE_KEYS.REFRESH_TOKEN),
    deleteItem(STORAGE_KEYS.USER_ID),
    deleteItem(STORAGE_KEYS.USER_EMAIL),
    deleteItem(STORAGE_KEYS.USER_NAME),
    deleteItem(STORAGE_KEYS.USER_PLAN),
    deleteItem(STORAGE_KEYS.USER_CREATED_AT),
    deleteItem(STORAGE_KEYS.USER_TRIAL_ENDS_AT),
  ]);
}
