// Shapes returned by the Django API (backend/api/serializers.py).

export type Category = 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory' | 'bag';

export interface GarmentColor {
  name: string;
  rgb?: [number, number, number];
  lab?: [number, number, number];
  share: number;
}

export interface Material {
  value?: string;
  source?: 'care_label' | 'user' | 'visual_estimate';
  confidence?: number;
}

export interface Garment {
  id: string;
  /** Comfortable day temperatures (none for shoes and accessories) and whether it is made for rain. */
  weather_fit?: { min_temp_c: number | null; max_temp_c: number | null; rain_suitable: boolean };
  image: string | null;
  cutout: string | null;
  name: string;
  category: Category;
  subcategory: string;
  colors: GarmentColor[];
  primary_color: string | null;
  pattern: string;
  material: Material;
  surface: string;
  sheen: string;
  fit: string;
  length: string;
  season: string[];
  warmth: number;
  rain_ok: boolean;
  formality: number;
  occasion_tags: string[];
  style_tags: string[];
  attribute_confidence: Record<string, number>;
  times_worn: number;
  last_worn_at: string | null;
  status: 'available' | 'laundry' | 'stored' | 'archived';
  favorite: boolean;
  is_sample?: boolean;
  created_at: string;
}

export type ScoreKey =
  | 'color' | 'silhouette' | 'material' | 'occasion' | 'weather' | 'accessories' | 'taste' | 'rotation';

export type Scores = Record<ScoreKey, number> & { total: number };

export interface OutfitContext {
  occasion: string;
  date: string;
  season: string;
  temp_c: number | null;
  precip_prob: number | null;
  style?: string;
  weather?: Weather;
}

export interface Outfit {
  id: string;
  outfit_set: string | null;
  items: { slot: string; garment: Garment }[];
  palette: string[];
  scores: Scores;
  total_score: number;
  position: number;
  explanation: string;
  /** Editorial name from the server, e.g. "Effortless Smart Casual". */
  title?: string;
  /** Short grounded sentences for "Why this outfit works". */
  reasons?: string[];
  saved: boolean;
  context: OutfitContext;
  created_at: string;
}

export interface OutfitSet {
  id: string;
  date: string;
  occasion: string;
  context: OutfitContext;
  outfits: Outfit[];
}

export interface Weather {
  temp_c: number;
  temp_min_c: number;
  temp_max_c: number;
  precip_prob: number;
}

export interface User {
  id: number;
  email: string;
  display_name: string;
  wardrobe_style: 'menswear' | 'womenswear' | 'neutral';
  style_direction: string;
  main_occasion: string;
  onboarded: boolean;
  preferred_styles?: string[];
  favorite_colors?: string[];
  sizes?: { top?: string; bottom?: string; shoes?: string };
  typical_occasions?: string[];
  units?: 'metric' | 'imperial';
  notifications_enabled?: boolean;
  plan?: 'free' | 'premium';
  /** Looking around without an account; signing up keeps everything. */
  is_guest?: boolean;
  latitude: number | null;
  longitude: number | null;
  /** About you: what a stylist asks. All optional; never shown to admins. */
  gender?: '' | 'female' | 'male' | 'other' | 'unsaid';
  birth_year?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  body_shape?: '' | 'rectangle' | 'triangle' | 'inverted_triangle' | 'hourglass' | 'oval';
  fit_preference?: '' | 'slim' | 'regular' | 'relaxed' | 'oversized';
  budget?: '' | 'low' | 'mid' | 'high';
  avoid_colors?: string[];
  /** MVP v2 profile. */
  age_range?: '' | '18-24' | '25-34' | '35-44' | '45-54' | '55+';
  country?: string;
  budget_ranges?: string[];
  stores?: string[];
}

/** A catalogue piece (MVP v2): something to buy, not something owned. */
export interface Product {
  id: string;
  name: string;
  store: string;
  brand: string;
  price: number;
  previous_price: number | null;
  currency: string;
  category: Category;
  subcategory: string;
  color: string;
  rgb: [number, number, number];
  material: string;
  styles: string[];
  image_url: string;
  rating: number | null;
  small_brand: boolean;
  /** Paid placement; always labelled. */
  sponsored: boolean;
  /** From the demo catalogue: the Shop link is a store search. */
  is_demo: boolean;
  /** "Why this?": the strongest true reason it was picked. */
  why: string;
  saved: boolean;
}

export interface Look {
  items: Product[];
  total: number;
  stores: string[];
}

export interface SavedItem {
  product: Product;
  tracking: boolean;
  /** [was, now] when the price fell since it was saved. */
  drop: [number, number] | null;
  saved_at: string;
}

export interface OccasionItem {
  id: number;
  title: string;
  date: string;
  kind: string;
  for_gift: boolean;
  person: string;
  days: number;
  /** Outfits are ready 15 days before; the reminder is at 7. */
  ready: boolean;
  remind: boolean;
}

export interface HomeFeed {
  look: Look | null;
  weather: Weather | null;
  picks: Product[];
  occasion: OccasionItem | null;
  price_drops: { product: Product; drop: [number, number] }[];
}

export interface Meta {
  categories: Record<Category, string[]>;
  colors: Record<string, [number, number, number]>;
  neutrals: string[];
  patterns: string[];
  surfaces: string[];
  sheens: string[];
  fits: string[];
  seasons: string[];
  statuses: string[];
  occasions: Record<string, [number, number]>;
  style_directions: string[];
  material_sources: string[];
}

export interface Stats {
  total: number;
  by_category: Partial<Record<Category, number>>;
  worn_last_30_days: number;
  rotation_pct: number;
  never_worn: number;
  most_worn: Garment[];
  outfits_saved: number;
  worn_outfits?: number;
  most_worn_categories?: { category: Category; count: number }[];
  favorite_style?: string;
  weekly_activity?: { date: string; count: number }[];
  favorites?: number;
  recently_added?: Garment[];
}

/** A piece worth buying to complete the closet, with store search links. */
export interface ShoppingSuggestion {
  id: string;
  title: string;
  reason: string;
  category: string;
  subcategory: string;
  color: string;
  rgb: [number, number, number];
  /** New good outfits the closet would gain with this piece. */
  unlocks: number;
  links: { store: string; url: string }[];
}

/** "Will this fit my wardrobe?" for a piece the user is thinking of buying. */
export interface FitCheck {
  verdict: 'great' | 'works' | 'skip';
  unlocks: number;
  matches: number;
  title: string;
  better: { color: string; unlocks: number; title: string } | null;
  links: { store: string; url: string }[];
}

/** One calendar day: what was worn, and the forecast when the day is within two weeks. */
export interface CalendarDay {
  date: string;
  worn: Outfit[];
  /** The outfit picked ahead for this day, if any. */
  plan: Outfit | null;
  weather: Weather | null;
}

export interface AssistantReply {
  reply: string;
  outfits: Outfit[];
  /** Closet pieces that go with a photo the user shared. */
  garments: Garment[];
  suggestions: string[];
  /** Garment fields of a recognised photo, ready to add to the closet. */
  piece: Partial<Garment> | null;
  /** The transcribed text of a voice question. */
  heard: string | null;
  /** Pieces to buy, when the question was about shopping. */
  shopping: ShoppingSuggestion[];
}

export interface Paged<T> {
  count: number;
  next: string | null;
  results: T[];
}

export interface VideoScan {
  id: string;
  status: 'processing' | 'done' | 'failed';
  error: '' | 'no_frames' | 'ai_unavailable' | 'ai_failed' | 'error';
  frames_used: number;
  garments: Garment[];
}
