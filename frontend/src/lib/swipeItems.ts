/**
 * The garment types onboarding asks yes / no about, one photo each (Unsplash,
 * the same checked photos as the demo catalogue; see backend/api/catalog_photos_CREDITS.md).
 * Answers go to user.type_prefs and steer Discover.
 */
export type SwipeItem = { sub: string; photo: string };

export const SWIPE_WOMEN: SwipeItem[] = [
  { sub: 't_shirt', photo: 'https://images.unsplash.com/photo-1620799139507-2a76f79a2f4d?w=800&q=80&fit=crop' },
  { sub: 'blouse', photo: 'https://images.unsplash.com/photo-1783700550072-1cc66ff4a947?w=800&q=80&fit=crop' },
  { sub: 'shirt', photo: 'https://images.unsplash.com/photo-1752825609278-f9696bc9d7bd?w=800&q=80&fit=crop' },
  { sub: 'sweater', photo: 'https://images.unsplash.com/photo-1773747310662-e7cc9e681226?w=800&q=80&fit=crop' },
  { sub: 'cardigan', photo: 'https://images.unsplash.com/photo-1683315565563-f72590773805?w=800&q=80&fit=crop' },
  { sub: 'jacket', photo: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80&fit=crop' },
  { sub: 'jeans', photo: 'https://images.unsplash.com/photo-1789110854969-94d36ba7636e?w=800&q=80&fit=crop' },
  { sub: 'skirt', photo: 'https://images.unsplash.com/photo-1678300410347-fc1accb1b19b?w=800&q=80&fit=crop' },
  { sub: 'day_dress', photo: 'https://images.unsplash.com/photo-1622738336927-7584b695fc88?w=800&q=80&fit=crop' },
  { sub: 'sneakers', photo: 'https://images.unsplash.com/photo-1777339862772-d6d3ed390efa?w=800&q=80&fit=crop' },
];

export const SWIPE_MEN: SwipeItem[] = [
  { sub: 't_shirt', photo: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&q=80&fit=crop' },
  { sub: 'polo', photo: 'https://images.unsplash.com/photo-1717127036020-83774f354008?w=800&q=80&fit=crop' },
  { sub: 'shirt', photo: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?w=800&q=80&fit=crop' },
  { sub: 'sweater', photo: 'https://images.unsplash.com/photo-1611312449545-94176309c857?w=800&q=80&fit=crop' },
  { sub: 'cardigan', photo: 'https://images.unsplash.com/photo-1683315565563-f72590773805?w=800&q=80&fit=crop' },
  { sub: 'hoodie', photo: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80&fit=crop' },
  { sub: 'jacket', photo: 'https://images.unsplash.com/photo-1579592610812-49855d94db0d?w=800&q=80&fit=crop' },
  { sub: 'blazer', photo: 'https://images.unsplash.com/photo-1740710748146-a15d840d6f40?w=800&q=80&fit=crop' },
  { sub: 'jeans', photo: 'https://images.unsplash.com/photo-1714143164139-8fdc14bf3054?w=800&q=80&fit=crop' },
  { sub: 'sneakers', photo: 'https://images.unsplash.com/photo-1777339862772-d6d3ed390efa?w=800&q=80&fit=crop' },
];
