import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { sendInstallSource } from '../services/api';

/**
 * Where an Android install came from: Google Play's install referrer. A Play
 * link carrying `&referrer=utm_source%3Dinstagram…` hands that string to the
 * app it installed; Play's own answer for an install with no campaign is
 * utm_source=google-play&utm_medium=organic, which still counts. The App Store
 * has nothing like it, so on iOS this does nothing.
 *
 * Read once and sent once per account (the server keeps the first answer).
 * Guarded at every step: the native module is missing from builds made before
 * expo-application was added, which still receive this code as an OTA.
 * Ported from SaveDo (frontend/src/installReferrer.ts).
 */
const RAW_KEY = 'WEARWISE_INSTALL_REF';
const SENT_KEY = 'WEARWISE_INSTALL_REF_SENT';

type Touch = { utm_source: string; utm_medium?: string; utm_campaign?: string };

export function parseReferrer(raw: string): Touch | null {
  const out: Record<string, string> = {};
  for (const part of raw.split('&')) {
    const [k, v = ''] = part.split('=');
    if (!k || !['utm_source', 'utm_medium', 'utm_campaign'].includes(k)) continue;
    let value = v;
    try { value = decodeURIComponent(v.replace(/\+/g, ' ')); } catch { /* keep raw */ }
    value = value.trim().slice(0, 100);
    if (value && value !== '(not set)') out[k] = value;
  }
  return out.utm_source ? (out as Touch) : null;
}

async function readRaw(): Promise<string | null> {
  try {
    const kept = await AsyncStorage.getItem(RAW_KEY);
    if (kept !== null) return kept;
  } catch { /* read from Play below */ }
  try {
    // Required here, not imported: an OTA onto a build without the module must fail softly, not at load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Application = require('expo-application');
    const raw: string = await Promise.race([
      Application.getInstallReferrerAsync(),
      new Promise<string>((_, no) => setTimeout(() => no(new Error('timeout')), 4000)),
    ]);
    try { await AsyncStorage.setItem(RAW_KEY, raw || ''); } catch { /* fine */ }
    return raw || '';
  } catch {
    return null; // no module, Play unreachable or slow: try again next launch
  }
}

/** Send the install's source for this account once; quiet on every failure. */
export async function reportInstallSource(userId: number | string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    if ((await AsyncStorage.getItem(SENT_KEY)) === String(userId)) return;
    const raw = await readRaw();
    if (raw === null) return;
    const touch = parseReferrer(raw);
    if (touch) await sendInstallSource(touch);
    await AsyncStorage.setItem(SENT_KEY, String(userId));
  } catch { /* next launch */ }
}
