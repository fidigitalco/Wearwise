import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type {
  AssistantReply, CalendarDay, FitCheck, Garment, HomeFeed, Look, OccasionItem, Product, SavedItem, Meta, ShoppingSuggestion, Outfit, OutfitSet, Paged, Scores, Stats, User, VideoScan, Weather,
} from '../types';

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
let language = 'az';

/** The app's language, sent to the server so explanations come back in it. */
export function setApiLanguage(lang: string) {
  language = lang;
}

// errorMessage is called outside React, so its two generic messages live here.
const GENERIC: Record<string, { error: string; network: string }> = {
  az: { error: 'Nəsə alınmadı. Bir daha cəhd et.', network: 'Serverə qoşulmaq olmur. İnterneti yoxla.' },
  en: { error: 'Something went wrong. Please try again.', network: 'Cannot reach the server. Check your connection.' },
  ru: { error: 'Что-то пошло не так. Попробуйте ещё раз.', network: 'Нет связи с сервером. Проверьте интернет.' },
  tr: { error: 'Bir şeyler ters gitti. Lütfen tekrar dene.', network: 'Sunucuya ulaşılamıyor. Bağlantını kontrol et.' },
  es: { error: 'Algo salió mal. Inténtalo de nuevo.', network: 'No se puede conectar con el servidor. Revisa tu conexión.' },
};

export const http = axios.create({ baseURL: BASE_URL, timeout: 20000 });

/** The phone's own region ("AZ") from its locale, or '' when it cannot be read. */
function deviceRegion(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    const m = locale.replace(/_/g, '-').match(/-([A-Za-z]{2})(?:-|$)/);
    return m ? m[1].toUpperCase() : '';
  } catch {
    return '';
  }
}

export const APP_VERSION = Constants.expoConfig?.version ?? '';
const REGION = deviceRegion();

http.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Token ${token}`;
  config.headers['Accept-Language'] = language;
  // Where the account is used from, for the admin panel (backend api/middleware.py).
  config.headers['X-Platform'] = Platform.OS;
  if (APP_VERSION) config.headers['X-App-Version'] = APP_VERSION;
  if (REGION) config.headers['X-Country'] = REGION;
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

/**
 * A message for an error the screen did not handle itself. Server texts are
 * English, so in Azerbaijani only the generic message is shown; screens map the
 * errors that matter (wrong password, unrecognised photo…) to their own strings.
 */
export function errorMessage(err: unknown): string {
  const g = GENERIC[language] ?? GENERIC.en;
  const e = err as AxiosError<any>;
  if (!e?.response) return e?.message === 'Network Error' || e?.code === 'ECONNABORTED' ? g.network : g.error;
  const d = e.response.data;
  if (language !== 'en' || !d || typeof d === 'string' || e.response.status >= 500) return g.error;
  if (d.detail) return String(d.detail);
  const first = Object.values(d)[0];
  if (Array.isArray(first)) return String(first[0]);
  if (typeof first === 'string') return first;
  return g.error;
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
  /** Sign in with Apple or Google using the identity token the provider returned. */
  social: (provider: 'apple' | 'google', id_token: string, name?: string) =>
    http.post<AuthResponse>('/auth/social/', { provider, id_token, name }).then((r) => r.data),
  /** Apple's web sign-in page (Android), returning to the given app link. */
  appleStart: (returnUrl: string) =>
    http.get<{ url: string }>('/auth/apple/start/', { params: { return: returnUrl } }).then((r) => r.data.url),
  /** A guest account with the sample wardrobe, for looking around before signing up. */
  guest: () => http.post<AuthResponse>('/auth/guest/').then((r) => r.data),
  /** Sign up from a guest account, keeping its closet. */
  claim: (email: string, password: string, display_name: string) =>
    http.post<AuthResponse>('/auth/claim/', { email, password, display_name }).then((r) => r.data),
  logout: () => http.post('/auth/logout/'),
  me: () => http.get<User>('/auth/me/').then((r) => r.data),
  update: (patch: Partial<User>) => http.patch<User>('/auth/me/', patch).then((r) => r.data),
  deleteAccount: () => http.delete('/auth/me/'),
};

export const calendar = {
  /** A month (YYYY-MM): days with something worn as {date: count}, and the days with a planned outfit. */
  month: (month: string) =>
    http.get<{ days: Record<string, number>; planned: string[] }>('/calendar/', { params: { month } }).then((r) => r.data),
  day: (date: string, lat?: number, lon?: number) =>
    http.get<CalendarDay>('/calendar/day/', { params: { date, lat, lon } }).then((r) => r.data),
  /** Keep an outfit for a day (today or later), replacing an earlier pick; it is saved to the looks too. */
  plan: (date: string, outfit: string) =>
    http.post<{ date: string; plan: Outfit }>('/calendar/plan/', { date, outfit }).then((r) => r.data.plan),
  unplan: (date: string) => http.delete('/calendar/plan/', { params: { date } }),
};

/** Pieces that would complete the closet, each with store search links. */
export const getShopping = () =>
  http.get<{ suggestions: ShoppingSuggestion[] }>('/shopping/').then((r) => r.data.suggestions);

export const shopping = {
  check: (subcategory: string, color: string) => http.post<FitCheck>('/shopping/check/', { subcategory, color }).then((r) => r.data),
  /** Logged before a store opens; failures never block the link. */
  click: (body: { store: string; subcategory: string; color: string; source: 'gap' | 'check' | 'assistant' }) =>
    http.post('/shopping/click/', body).then(() => undefined),
};

/** The day's plan in the user's words → the occasion it reads as. */
export const readPlan = (text: string) =>
  http.post<{ occasion: string | null; level: 'formal' | 'smart' | 'casual' | null }>('/plan/read/', { text }).then((r) => r.data);

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
  list: (params?: { category?: string; status?: string; favorite?: boolean }) =>
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
  setFavorite: (id: string, favorite: boolean) => http.patch<Garment>(`/garments/${id}/`, { favorite }).then((r) => r.data),
  loadSample: () => http.post<Garment[]>('/garments/sample/').then((r) => r.data),
  removeSample: () => http.delete('/garments/sample/'),
  detectColors: (id: string) => http.post<Garment>(`/garments/${id}/detect-colors/`).then((r) => r.data),
};

// ── Outfits ─────────────────────────────────────────────────────────────────
export type RecommendInput = {
  occasion: string;
  temp_c?: number | null;
  precip_prob?: number | null;
  latitude?: number;
  longitude?: number;
  /** One-off style filter; the saved preference is used when absent. */
  style?: string;
  /** A day in the season to dress for (season filter). */
  date?: string;
};

export type CheckResult = { scores: Scores; explanation: string; outfit?: Outfit };

export const outfits = {
  recommend: (input: RecommendInput) => http.post<OutfitSet>('/recommendations/', input).then((r) => r.data),
  /** Today's latest suggestions for an occasion, or null if none were made yet. */
  latest: (occasion: string) =>
    http
      .get<OutfitSet>('/recommendations/latest/', { params: { occasion } })
      .then((r) => r.data)
      .catch((e: AxiosError) => {
        if (e.response?.status === 404) return null;
        throw e;
      }),
  check: (input: { garment_ids: string[]; occasion: string; temp_c?: number | null; precip_prob?: number | null; save?: boolean }) =>
    http.post<CheckResult>('/check-outfit/', input).then((r) => r.data),
  list: (params?: { saved?: boolean }) =>
    http.get<Paged<Outfit>>('/outfits/', { params: { limit: 100, ...params } }).then((r) => r.data.results),
  get: (id: string) => http.get<Outfit>(`/outfits/${id}/`).then((r) => r.data),
  setSaved: (id: string, saved: boolean) => http.post<Outfit>(`/outfits/${id}/save/`, { saved }).then((r) => r.data),
  alternatives: (id: string, slot: string) =>
    http
      .get<{ current_total: number; options: { garment: Garment; total: number }[] }>(`/outfits/${id}/alternatives/`, { params: { slot } })
      .then((r) => r.data),
  swap: (id: string, slot: string, garmentId: string) =>
    http.post<Outfit>(`/outfits/${id}/swap/`, { slot, garment_id: garmentId }).then((r) => r.data),
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

// ── AI stylist ──────────────────────────────────────────────────────────────
// The server owns the stylist (rule-based today, an LLM later); the app only sends the question.
export const assistant = {
  /** A typed question, optionally with a photo; or a voice recording the server transcribes. */
  ask: (message: string, attach?: { image?: LocalImage; audio?: LocalImage }) => {
    if (!attach?.image && !attach?.audio) {
      return http.post<AssistantReply>('/assistant/', { message }, { timeout: 60000 }).then((r) => r.data);
    }
    const form = new FormData();
    form.append('message', message);
    if (attach.image) {
      const type = attach.image.mimeType || 'image/jpeg';
      form.append('image', { uri: attach.image.uri, name: attach.image.fileName || `photo.${type.split('/')[1] || 'jpg'}`, type } as any);
    }
    if (attach.audio) {
      form.append('audio', { uri: attach.audio.uri, name: attach.audio.fileName || 'question.m4a', type: attach.audio.mimeType || 'audio/m4a' } as any);
    }
    return http
      .post<AssistantReply>('/assistant/', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90000 })
      .then((r) => r.data);
  },
};

// ── Video scans ─────────────────────────────────────────────────────────────
export const scans = {
  create: (video: LocalImage) => {
    const form = new FormData();
    const type = video.mimeType || 'video/mp4';
    form.append('video', { uri: video.uri, name: video.fileName || `closet.${type.split('/')[1] || 'mp4'}`, type } as any);
    // Videos are large and phones are on Wi-Fi or worse: give the upload time.
    return http
      .post<VideoScan>('/scans/', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000 })
      .then((r) => r.data);
  },
  get: (id: string) => http.get<VideoScan>(`/scans/${id}/`).then((r) => r.data),
};

export const getWeather = (lat: number, lon: number) =>
  http.get<Weather>('/weather/', { params: { lat, lon } }).then((r) => r.data);

export const getStats = () => http.get<Stats>('/stats/').then((r) => r.data);

/** Settings → Send feedback; staff read it in the admin panel. */
/** A JavaScript error the app could not recover from; never throws. */
export const reportCrash = (body: { message: string; stack?: string; fatal?: boolean; device?: string }) =>
  http.post('/crash/', body, { timeout: 8000 }).then(() => undefined).catch(() => undefined);

/** Google Play's install referrer (Android), sent once; the server keeps the first answer. */
export const sendInstallSource = (body: { utm_source: string; utm_medium?: string; utm_campaign?: string }) =>
  http.post('/me/install/', body).then(() => undefined);

export const sendAppFeedback = (
  body: { kind: 'idea' | 'problem' | 'other'; message: string; platform: string; app_version: string },
  shots: LocalImage[] = [],
) => {
  if (!shots.length) return http.post('/app-feedback/', body).then(() => undefined);
  // Multipart only when there is something to attach (the server keeps up to 3 images).
  const form = new FormData();
  for (const [k, v] of Object.entries(body)) form.append(k, String(v));
  shots.forEach((img, i) => {
    const type = img.mimeType || 'image/jpeg';
    const ext = type.split('/')[1] || 'jpg';
    form.append('screenshots', { uri: img.uri, name: img.fileName || `screenshot-${i + 1}.${ext}`, type } as any);
  });
  return http
    .post('/app-feedback/', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
    .then(() => undefined);
};

// ── Shopping catalogue (MVP v2) ─────────────────────────────────────────────

export type ProductAction = 'like' | 'not_me' | 'save' | 'shop';

export const catalog = {
  home: (lat?: number, lon?: number) =>
    http.get<HomeFeed>('/home/', { params: lat !== undefined ? { lat, lon } : undefined }).then((r) => r.data),
  discover: () => http.get<{ products: Product[]; next_drop: string; learned: number }>('/discover/').then((r) => r.data),
  /** Shop returns the tracked link to open. */
  act: (id: string, action: ProductAction) =>
    http.post<{ learned: number; saved?: boolean; url?: string }>(`/products/${id}/action/`, { action }).then((r) => r.data),
  saved: () => http.get<{ items: SavedItem[]; tracking_limit: number | null }>('/saved/').then((r) => r.data),
  save: (id: string) => http.post('/saved/', { product: id }).then(() => undefined),
  unsave: (id: string) => http.delete(`/saved/${id}/`).then(() => undefined),
  track: (id: string, tracking: boolean) => http.patch<{ tracking: boolean }>(`/saved/${id}/`, { tracking }).then((r) => r.data),
};

export const occasions = {
  list: () => http.get<OccasionItem[]>('/occasions/').then((r) => r.data),
  get: (id: number) => http.get<OccasionItem & { looks: Look[] }>(`/occasions/${id}/`).then((r) => r.data),
  add: (body: { title: string; date: string; kind: string; for_gift: boolean; person: string }) =>
    http.post<OccasionItem>('/occasions/', body).then((r) => r.data),
  remove: (id: number) => http.delete(`/occasions/${id}/`).then(() => undefined),
  /** Wear one of my outfits on the date, or null to clear it. */
  setOutfit: (id: number, outfit: string | null) =>
    http.patch<OccasionItem & { looks: Look[] }>(`/occasions/${id}/`, { outfit }).then((r) => r.data),
};

export interface SuitsMe {
  score: number;
  verdict: 'great' | 'good' | 'risky' | 'skip';
  subcategory: string | null;
  category: string | null;
  color: string | null;
  rgb: [number, number, number] | null;
  style_ok: boolean;
  color_fit: 'love' | 'avoid' | 'ok' | 'unknown';
  pairs_with: number;
  better_color: boolean;
  alternatives: Product[];
  left: number | null;
}

/** "Does this suit me?" from a photo or a product link; free plan: 5 a month. */
export const suitsMe = {
  left: () => http.get<{ left: number | null }>('/suits-me/').then((r) => r.data.left),
  photo: (image: LocalImage) => {
    const form = new FormData();
    form.append('image', { uri: image.uri, name: image.fileName || 'check.jpg', type: image.mimeType || 'image/jpeg' } as any);
    return http.post<SuitsMe>('/suits-me/', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }).then((r) => r.data);
  },
  link: (link: string) => http.post<SuitsMe>('/suits-me/', { link }).then((r) => r.data),
};

export interface Inspiration {
  id: number;
  image: string | null;
  link: string;
  subcategory: string;
  color: string;
  rgb: [number, number, number] | null;
  note: string;
  created_at: string;
}

/** The inspiration board: photos and links of things the user liked, which teach Discovery their taste. */
export const inspirations = {
  list: () => http.get<{ items: Inspiration[]; learned: number }>('/inspirations/').then((r) => r.data),
  photo: (image: LocalImage) => {
    const form = new FormData();
    form.append('image', { uri: image.uri, name: image.fileName || 'inspiration.jpg', type: image.mimeType || 'image/jpeg' } as any);
    return http.post<Inspiration>('/inspirations/', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }).then((r) => r.data);
  },
  link: (link: string) => http.post<Inspiration>('/inspirations/', { link }).then((r) => r.data),
  remove: (id: number) => http.delete(`/inspirations/${id}/`).then(() => undefined),
};
