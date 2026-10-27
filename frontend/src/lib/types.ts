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
  latitude: number | null;
  longitude: number | null;
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
}

export interface Paged<T> {
  count: number;
  next: string | null;
  results: T[];
}
