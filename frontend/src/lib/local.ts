import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Small per-device lists kept on the phone only: recent searches and recently
 * viewed outfits. Losing them is harmless, so every read falls back to empty.
 */
async function readList(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function pushFront(key: string, value: string, max: number): Promise<string[]> {
  const next = [value, ...(await readList(key)).filter((x) => x !== value)].slice(0, max);
  AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
  return next;
}

const SEARCHES = 'WEARWISE_RECENT_SEARCHES';
const VIEWED = 'WEARWISE_RECENT_OUTFITS';

export const recentSearches = {
  get: () => readList(SEARCHES),
  add: (q: string) => pushFront(SEARCHES, q.trim(), 8),
  clear: () => AsyncStorage.removeItem(SEARCHES).catch(() => {}),
};

export const recentlyViewed = {
  get: () => readList(VIEWED),
  add: (outfitId: string) => pushFront(VIEWED, outfitId, 20),
};
