import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

/**
 * The store page where a review is written, from app.json (`ios.appStoreUrl`,
 * `android.playStoreUrl`); null until the app is listed there.
 */
export function reviewUrl(): string | null {
  const cfg = Constants.expoConfig;
  if (Platform.OS === 'ios') {
    const url = cfg?.ios?.appStoreUrl;
    return url ? `${url}${url.includes('?') ? '&' : '?'}action=write-review` : null;
  }
  if (Platform.OS === 'android') {
    const url = cfg?.android?.playStoreUrl;
    return url ? `${url}${url.includes('?') ? '&' : '?'}showAllReviews=true` : null;
  }
  return null;
}

/** Opens the store's review page; false when the app is not listed yet. */
export async function openStoreReview(): Promise<boolean> {
  const url = reviewUrl();
  if (!url) return false;
  await Linking.openURL(url);
  return true;
}
