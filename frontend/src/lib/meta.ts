import { useEffect, useState } from 'react';
import { getMeta } from '../services/api';
import { LIGHT } from '../theme';
import type { Category, Meta } from '../types';

/**
 * The taxonomy the server accepts. A copy ships with the app so pickers work
 * before (or without) the first /meta response; the server's copy replaces it.
 */
const FALLBACK: Meta = {
  categories: {
    top: ['t_shirt', 'shirt', 'blouse', 'polo', 'sweater', 'hoodie', 'cardigan', 'tank_top'],
    bottom: ['jeans', 'trousers', 'chinos', 'shorts', 'skirt', 'joggers', 'leggings'],
    dress: ['day_dress', 'evening_dress', 'jumpsuit'],
    outerwear: ['blazer', 'jacket', 'rain_jacket', 'coat', 'puffer', 'trench', 'denim_jacket'],
    shoes: ['sneakers', 'loafers', 'boots', 'heels', 'sandals', 'oxfords', 'flats'],
    accessory: ['belt', 'scarf', 'hat', 'watch', 'jewellery', 'tie', 'sunglasses'],
    bag: ['tote', 'backpack', 'crossbody', 'clutch', 'briefcase'],
  },
  colors: {
    black: [20, 20, 20], white: [245, 245, 245], cream: [240, 228, 200], grey: [140, 140, 140],
    charcoal: [60, 62, 66], navy: [30, 40, 80], blue: [40, 90, 180], light_blue: [150, 190, 230],
    teal: [0, 120, 120], green: [40, 130, 60], olive: [110, 110, 50], khaki: [190, 175, 130],
    beige: [215, 195, 160], camel: [190, 140, 80], brown: [110, 70, 40], burgundy: [110, 25, 45],
    red: [200, 30, 40], pink: [235, 160, 180], purple: [110, 60, 140], yellow: [217, 169, 51],
    orange: [230, 120, 40], mustard: [200, 160, 40],
  },
  neutrals: ['beige', 'black', 'brown', 'camel', 'charcoal', 'cream', 'grey', 'khaki', 'navy', 'white'],
  patterns: ['solid', 'stripe', 'check', 'floral', 'print', 'dots', 'graphic', 'animal'],
  surfaces: ['smooth', 'textured', 'knit', 'ribbed', 'fuzzy'],
  sheens: ['matte', 'low', 'medium', 'high'],
  fits: ['slim', 'regular', 'relaxed', 'oversized'],
  seasons: ['spring', 'summer', 'autumn', 'winter'],
  statuses: ['available', 'laundry', 'stored', 'archived'],
  occasions: {
    casual: [1, 3], work: [2, 4], client_meeting: [3, 5], date: [2, 4],
    party: [2, 5], formal: [4, 5], sport: [1, 2], travel: [1, 3],
  },
  style_directions: ['casual', 'smart_casual', 'business', 'formal', 'sporty', 'streetwear', 'minimal'],
  material_sources: ['care_label', 'user', 'visual_estimate'],
};

let cached: Meta | null = null;

export function useMeta(): Meta {
  const [meta, setMeta] = useState<Meta>(cached ?? FALLBACK);
  useEffect(() => {
    if (cached) return;
    getMeta()
      .then((m) => {
        cached = m;
        setMeta(m);
      })
      .catch(() => {});
  }, []);
  return meta;
}

export const CATEGORY_ORDER: Category[] = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'bag'];

export function rgbCss(rgb: [number, number, number] | undefined): string {
  // Garment colours are data, not theme; unknown ones fall back to the border tone.
  return rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : LIGHT.swatchFallback;
}

/** Kinds hidden from a men's wardrobe when adding a piece (Settings → What do you wear?). */
const WOMENSWEAR_ONLY = new Set(['blouse', 'skirt', 'leggings', 'day_dress', 'evening_dress', 'jumpsuit', 'heels', 'flats', 'clutch']);

export function categoriesFor(wardrobe: string | undefined): Category[] {
  return wardrobe === 'menswear' ? CATEGORY_ORDER.filter((c) => c !== 'dress') : CATEGORY_ORDER;
}

export function subcategoriesFor(meta: Meta, category: Category, wardrobe: string | undefined): string[] {
  const all = meta.categories[category] ?? [];
  return wardrobe === 'menswear' ? all.filter((s) => !WOMENSWEAR_ONLY.has(s)) : all;
}
