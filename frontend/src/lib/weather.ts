import * as Location from 'expo-location';
import { getWeather } from '../services/api';
import type { User, Weather } from '../types';

/** Baku, used when the phone gives no location and none is saved. */
export const FALLBACK = { lat: 40.41, lon: 49.87 };

export type WeatherInfo = Weather & {
  /** City name when the phone could tell; null when unknown. */
  city: string | null;
  /** True when this is the fallback city, not the user's own location. */
  fallback: boolean;
  /** The coordinates the forecast is for, so other days can be asked about the same place. */
  lat: number;
  lon: number;
};

let cached: { at: number; info: WeatherInfo } | null = null;
const FRESH_MS = 15 * 60 * 1000;

/**
 * Today's forecast for the phone's city, else the last location the server
 * knows, else the fallback city. Shared by every screen and kept for 15 minutes,
 * so moving between tabs does not refetch.
 */
export async function readWeather(
  user: User | null,
  updateUser: (p: Partial<User>) => Promise<void>,
  opts: { force?: boolean } = {},
): Promise<WeatherInfo | null> {
  if (!opts.force && cached && Date.now() - cached.at < FRESH_MS) return cached.info;
  let lat = user?.latitude ?? null;
  let lon = user?.longitude ?? null;
  let city: string | null = null;
  let fallback = false;
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.granted) {
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
      // City-level is all the forecast needs; never store more than that.
      lat = Math.round(pos.coords.latitude * 100) / 100;
      lon = Math.round(pos.coords.longitude * 100) / 100;
      if (lat !== user?.latitude || lon !== user?.longitude) updateUser({ latitude: lat, longitude: lon }).catch(() => {});
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }).catch(() => []);
      city = place?.city ?? place?.subregion ?? place?.region ?? null;
    }
  } catch {
    // Location off or unavailable: fall through to the saved or fallback city.
  }
  if (lat == null || lon == null) {
    ({ lat, lon } = FALLBACK);
    fallback = true;
  }
  try {
    const info = { ...(await getWeather(lat, lon)), city, fallback, lat, lon };
    cached = { at: Date.now(), info };
    return info;
  } catch {
    return null;
  }
}
