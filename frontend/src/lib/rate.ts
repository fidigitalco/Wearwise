import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

/**
 * The store page where a review is written. iOS needs `ios.appStoreUrl` in app.json (null until the
 * app is on the App Store). Android uses `android.playStoreUrl` when set, else the package name,
 * which always points at the app's own Play page.
 */
export function reviewUrl(): string | null {
  const cfg = Constants.expoConfig;
  if (Platform.OS === 'ios') {
    const url = cfg?.ios?.appStoreUrl;
    return url ? `${url}${url.includes('?') ? '&' : '?'}action=write-review` : null;
  }
  if (Platform.OS === 'android') {
    const url = cfg?.android?.playStoreUrl;
    if (url) return `${url}${url.includes('?') ? '&' : '?'}showAllReviews=true`;
    const pkg = cfg?.android?.package;
    return pkg ? `https://play.google.com/store/apps/details?id=${pkg}&showAllReviews=true` : null;
  }
  return null;
}

/** Opens the store's review page (the Play Store app on Android when it is there); false when there is none yet. */
export async function openStoreReview(): Promise<boolean> {
  const url = reviewUrl();
  if (!url) return false;
  const pkg = Constants.expoConfig?.android?.package;
  if (Platform.OS === 'android' && pkg) {
    try {
      await Linking.openURL(`market://details?id=${pkg}`);
      return true;
    } catch {
      // No Play Store app (some emulators and devices): the web page below.
    }
  }
  await Linking.openURL(url);
  return true;
}
