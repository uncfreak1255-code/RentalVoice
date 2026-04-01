// AI API Key Management
// Secure on-device storage for user-provided AI provider keys
// All AI calls route through the server proxy — no client-side API keys needed.
// User-saved keys are kept for the model picker / provider preference UI only.

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getGoogleAccessToken, isGoogleSignedIn } from './google-auth';

// Supported AI providers
export type AIProvider = 'google' | 'anthropic' | 'openai';

// Auth method for Google (OAuth vs API key)
export type GoogleAuthMethod = 'oauth' | 'api_key' | 'env' | 'none';

export interface AIProviderConfig {
  id: AIProvider;
  name: string;
  description: string;
  placeholder: string;
  docsUrl: string;
  envKey: string;
  color: string;
}

export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini 2.0 Flash — fast & free tier',
    placeholder: 'AIzaSy...',
    docsUrl: 'https://aistudio.google.com/apikey',
    envKey: '', // Keys are server-side only
    color: '#4285F4',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Haiku — accurate & reliable',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    envKey: '', // Keys are server-side only
    color: '#D97757',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o Mini — versatile',
    placeholder: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    envKey: '', // Keys are server-side only
    color: '#10A37F',
  },
];

// ─── AI Model Registry (for model picker) ────────────────

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
  color: string;
}

export const AI_MODELS: AIModel[] = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', description: 'Fast & free tier', color: '#4285F4' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', description: 'Most capable', color: '#4285F4' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', description: 'Fast & accurate', color: '#D97757' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', description: 'Best balance', color: '#D97757' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Fast & affordable', color: '#10A37F' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Most capable', color: '#10A37F' },
];

const SELECTED_MODEL_KEY = 'ai_selected_model';

// Storage keys
const KEY_PREFIX = 'ai_provider_key_';
const PROVIDER_ORDER_KEY = 'ai_provider_order';
const PROVIDER_ENABLED_PREFIX = 'ai_provider_enabled_';

// Secure storage helpers (same pattern as secure-storage.ts)
let secureStoreAvailable: boolean | null = null;

async function isSecureStoreAvailable(): Promise<boolean> {
  if (secureStoreAvailable !== null) return secureStoreAvailable;
  if (Platform.OS === 'web') {
    secureStoreAvailable = false;
    return false;
  }
  try {
    await SecureStore.getItemAsync('__test_ai_keys__');
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

// ─── Public API ──────────────────────────────────────────

/**
 * Get the API key (or OAuth token) for a provider.
 * All AI calls now route through the server proxy, so client-side keys
 * are only needed for Google OAuth (device-level) or user-saved keys.
 * No more .env fallback — secrets stay server-side.
 */
export async function getAIKey(provider: AIProvider): Promise<string | null> {
  try {
    // For Google: check OAuth token first
    if (provider === 'google') {
      const oauthToken = await getGoogleAccessToken();
      if (oauthToken) return oauthToken;
    }

    // Check user-saved key (from Settings UI)
    const userKey = await getItem(`${KEY_PREFIX}${provider}`);
    if (userKey) return userKey;

    // No .env fallback — server proxy handles keys
    return null;
  } catch (error) {
    console.error(`[AIKeys] Failed to get key for ${provider}:`, error);
    return null;
  }
}

/**
 * Save a user-provided API key
 */
export async function setAIKey(provider: AIProvider, key: string): Promise<void> {
  await setItem(`${KEY_PREFIX}${provider}`, key);
  console.log(`[AIKeys] Saved key for ${provider}`);
}

/**
 * Delete the user-provided API key for a provider
 */
export async function deleteAIKey(provider: AIProvider): Promise<void> {
  await deleteItem(`${KEY_PREFIX}${provider}`);
  console.log(`[AIKeys] Deleted key for ${provider}`);
}

/**
 * Check if a user has saved a custom key (not from .env)
 */
export async function hasUserKey(provider: AIProvider): Promise<boolean> {
  const key = await getItem(`${KEY_PREFIX}${provider}`);
  return key !== null && key.length > 0;
}

/**
 * Get whether a provider is enabled
 */
export async function isProviderEnabled(provider: AIProvider): Promise<boolean> {
  const val = await getItem(`${PROVIDER_ENABLED_PREFIX}${provider}`);
  // Default: enabled if key is available
  if (val === null) return true;
  return val === 'true';
}

/**
 * Set whether a provider is enabled
 */
export async function setProviderEnabled(provider: AIProvider, enabled: boolean): Promise<void> {
  await setItem(`${PROVIDER_ENABLED_PREFIX}${provider}`, enabled.toString());
}

/**
 * Get the ordered list of providers for the fallback chain
 */
export async function getProviderOrder(): Promise<AIProvider[]> {
  try {
    const saved = await getItem(PROVIDER_ORDER_KEY);
    if (saved) {
      return JSON.parse(saved) as AIProvider[];
    }
  } catch {
    // ignore parse errors
  }
  return ['google', 'anthropic', 'openai']; // Default order
}

/**
 * Save the provider fallback order
 */
export async function setProviderOrder(order: AIProvider[]): Promise<void> {
  await setItem(PROVIDER_ORDER_KEY, JSON.stringify(order));
  console.log('[AIKeys] Saved provider order:', order);
}

/**
 * Get all provider statuses at once (for the settings UI)
 */
export async function getAllProviderStatuses(): Promise<
  Record<AIProvider, { hasKey: boolean; isUserKey: boolean; enabled: boolean }>
> {
  const results: Record<AIProvider, { hasKey: boolean; isUserKey: boolean; enabled: boolean }> =
    {} as Record<AIProvider, { hasKey: boolean; isUserKey: boolean; enabled: boolean }>;

  for (const provider of AI_PROVIDERS) {
    const key = await getAIKey(provider.id);
    const isUser = await hasUserKey(provider.id);
    const enabled = await isProviderEnabled(provider.id);
    results[provider.id] = {
      hasKey: key !== null && key.length > 0,
      isUserKey: isUser,
      enabled,
    };
  }
  return results;
}

/**
 * Test an API key by making a minimal call through the server proxy.
 * The server validates the key against the real provider.
 */
export async function testAIKey(
  provider: AIProvider,
  key: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const { API_BASE_URL } = require('./config');
    const res = await fetch(`${API_BASE_URL}/api/ai-proxy/test-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `Error: ${res.status}` }));
      return { valid: false, error: data.error || `Error: ${res.status}` };
    }
    const data = await res.json();
    return { valid: data.valid !== false, error: data.error };
  } catch {
    return { valid: false, error: 'Network error — check your connection' };
  }
}

/**
 * Clear all user-provided AI keys
 */
export async function clearAllAIKeys(): Promise<void> {
  for (const provider of AI_PROVIDERS) {
    await deleteItem(`${KEY_PREFIX}${provider.id}`);
    await deleteItem(`${PROVIDER_ENABLED_PREFIX}${provider.id}`);
  }
  await deleteItem(PROVIDER_ORDER_KEY);
  await deleteItem(SELECTED_MODEL_KEY);
  console.log('[AIKeys] All AI keys cleared');
}

// ─── Google Auth Method Detection ─────────────────────────

/**
 * Detect which auth method is active for Google.
 * Returns: 'oauth' | 'api_key' | 'env' | 'none'
 * Note: 'env' is no longer returned — keys live server-side only.
 */
export async function getGoogleAuthMethod(): Promise<GoogleAuthMethod> {
  const signedIn = await isGoogleSignedIn();
  if (signedIn) return 'oauth';

  const userKey = await getItem(`${KEY_PREFIX}google`);
  if (userKey) return 'api_key';

  // Server proxy handles keys; 'none' just means no local key
  return 'none';
}

// ─── Model Picker ─────────────────────────────────────────

/** Get the user's selected model ID, or null for auto/default */
export async function getSelectedModel(): Promise<string | null> {
  return getItem(SELECTED_MODEL_KEY);
}

/** Save the user's selected model */
export async function setSelectedModel(modelId: string | null): Promise<void> {
  if (modelId) {
    await setItem(SELECTED_MODEL_KEY, modelId);
  } else {
    await deleteItem(SELECTED_MODEL_KEY);
  }
  console.log('[AIKeys] Selected model:', modelId || 'auto');
}

/**
 * Get models that are currently available (provider has a key & is enabled).
 * Used by the model picker UI.
 */
export async function getAvailableModels(): Promise<AIModel[]> {
  const available: AIModel[] = [];
  for (const model of AI_MODELS) {
    const enabled = await isProviderEnabled(model.provider);
    if (!enabled) continue;
    const key = await getAIKey(model.provider);
    if (key) available.push(model);
  }
  return available;
}
