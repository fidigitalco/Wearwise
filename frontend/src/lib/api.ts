import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Garment, Meta, Outfit, OutfitSet, Paged, Scores, Stats, User, Weather } from './types';

// The deployed backend a standalone build talks to.
const PROD_API_URL = 'https://api.wearwise.app/api';

function isPrivateLanIp(host: string): boolean {
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// Where the Django backend lives. EXPO_PUBLIC_API_BASE_URL always wins (needed
// for tunnel mode). Otherwise a phone on the LAN reuses Metro's IP with :8000,
// the Android emulator uses 10.0.2.2, and a build with no Metro host is a
// standalone build that talks to production.
function deriveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (!host) return PROD_API_URL;
  if (isPrivateLanIp(host)) return `http://${host}:8000/api`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000/api';
  return 'http://localhost:8000/api';
}

export const BASE_URL = deriveBaseUrl();
const TOKEN_KEY = 'WEARWISE_AUTH_TOKEN';

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const http = axios.create({ baseURL: BASE_URL, timeout: 20000 });

http.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401 && token) onUnauthorized?.();
    return Promise.reject(err);
  },
);

export async function loadToken(): Promise<string | null> {
  token = await AsyncStorage.getItem(TOKEN_KEY);
  return token;
}

export async function setToken(t: string | null) {
  token = t;
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

/** The first human-readable message in a DRF error response. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as AxiosError<any>;
  if (!e?.response) return e?.message === 'Network Error' ? 'Cannot reach the server. Check your connection.' : fallback;
  const d = e.response.data;
  if (!d) return fallback;
  if (typeof d === 'string') return fallback;
  if (d.detail) return String(d.detail);
  const first = Object.values(d)[0];
  if (Array.isArray(first)) return String(first[0]);
  if (typeof first === 'string') return first;
  return fallback;
}

/** Media URLs come back absolute from DRF; make sure relative ones resolve too. */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return BASE_URL.replace(/\/api$/, '') + path;
}

// ── Auth ────────────────────────────────────────────────────────────────────
type AuthResponse = { token: string; user: User };

export const auth = {
  register: (email: string, password: string, display_name?: string) =>
    http.post<AuthResponse>('/auth/register/', { email, password, display_name }).then((r) => r.data),
  login: (email: string, password: string) =>
    http.post<AuthResponse>('/auth/login/', { email, password }).then((r) => r.data),
  logout: () => http.post('/auth/logout/'),
  me: () => http.get<User>('/auth/me/').then((r) => r.data),
  update: (patch: Partial<User>) => http.patch<User>('/auth/me/', patch).then((r) => r.data),
  deleteAccount: () => http.delete('/auth/me/'),
};

export const getMeta = () => http.get<Meta>('/meta/').then((r) => r.data);

// ── Garments ────────────────────────────────────────────────────────────────
export type GarmentInput = Partial<Omit<Garment, 'id' | 'image' | 'cutout' | 'primary_color'>>;
export type LocalImage = { uri: string; mimeType?: string | null; fileName?: string | null };

function garmentForm(fields: GarmentInput, image?: LocalImage): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    // JSON fields go as JSON strings; DRF's JSONField parses them from multipart.
    form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  if (image) {
    const type = image.mimeType || 'image/jpeg';
    const ext = type.split('/')[1] || 'jpg';
    form.append('image', { uri: image.uri, name: image.fileName || `garment.${ext}`, type } as any);
  }
  return form;
}

export const garments = {
  list: (params?: { category?: string; status?: string }) =>
    http.get<Paged<Garment>>('/garments/', { params: { limit: 500, ...params } }).then((r) => r.data.results),
  get: (id: string) => http.get<Garment>(`/garments/${id}/`).then((r) => r.data),
  create: (fields: GarmentInput, image?: LocalImage) =>
    image
      ? http
          .post<Garment>('/garments/', garmentForm(fields, image), {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 60000,
          })
          .then((r) => r.data)
      : http.post<Garment>('/garments/', fields).then((r) => r.data),
  update: (id: string, patch: GarmentInput) => http.patch<Garment>(`/garments/${id}/`, patch).then((r) => r.data),
  remove: (id: string) => http.delete(`/garments/${id}/`),
  detectColors: (id: string) => http.post<Garment>(`/garments/${id}/detect-colors/`).then((r) => r.data),
};

// ── Outfits ─────────────────────────────────────────────────────────────────
export type RecommendInput = {
  occasion: string;
  temp_c?: number | null;
  precip_prob?: number | null;
  latitude?: number;
  longitude?: number;
};

export type CheckResult = { scores: Scores; explanation: string; outfit?: Outfit };

export const outfits = {
  recommend: (input: RecommendInput) => http.post<OutfitSet>('/recommendations/', input).then((r) => r.data),
  check: (input: { garment_ids: string[]; occasion: string; temp_c?: number | null; precip_prob?: number | null; save?: boolean }) =>
    http.post<CheckResult>('/check-outfit/', input).then((r) => r.data),
  list: (params?: { saved?: boolean }) =>
    http.get<Paged<Outfit>>('/outfits/', { params: { limit: 100, ...params } }).then((r) => r.data.results),
  get: (id: string) => http.get<Outfit>(`/outfits/${id}/`).then((r) => r.data),
  setSaved: (id: string, saved: boolean) => http.post<Outfit>(`/outfits/${id}/save/`, { saved }).then((r) => r.data),
  wear: (id: string) => http.post<{ worn_on: string }>(`/outfits/${id}/wear/`).then((r) => r.data),
  remove: (id: string) => http.delete(`/outfits/${id}/`),
  feedback: (input: {
    outfit: string;
    rank?: number;
    liked?: boolean | null;
    rejection_reason?: string;
    removed_garment_ids?: string[];
    replaced?: { from: string; to: string }[];
  }) => http.post('/feedback/', input).then((r) => r.data),
};

export const getWeather = (lat: number, lon: number) =>
  http.get<Weather>('/weather/', { params: { lat, lon } }).then((r) => r.data);

export const getStats = () => http.get<Stats>('/stats/').then((r) => r.data);
