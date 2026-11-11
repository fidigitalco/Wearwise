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
  { sub: 'polo', photo: 'https://images.unsplash.com/photo-1717127036020-83774f354008?w=800&q=80&fit=crop' },
  { sub: 'sweater', photo: 'https://images.unsplash.com/photo-1773747310662-e7cc9e681226?w=800&q=80&fit=crop' },
  { sub: 'cardigan', photo: 'https://images.unsplash.com/photo-1683315565563-f72590773805?w=800&q=80&fit=crop' },
  { sub: 'hoodie', photo: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80&fit=crop' },
  { sub: 'jacket', photo: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80&fit=crop' },
  { sub: 'blazer', photo: 'https://images.unsplash.com/photo-1749096291416-2c5e0f19a815?w=800&q=80&fit=crop' },
  { sub: 'trench', photo: 'https://images.unsplash.com/photo-1722859031306-4c81e8d83957?w=800&q=80&fit=crop' },
  { sub: 'coat', photo: 'https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=800&q=80&fit=crop' },
  { sub: 'puffer', photo: 'https://images.unsplash.com/photo-1611025504703-8c143abe6996?w=800&q=80&fit=crop' },
  { sub: 'jeans', photo: 'https://images.unsplash.com/photo-1789110854969-94d36ba7636e?w=800&q=80&fit=crop' },
  { sub: 'trousers', photo: 'https://images.unsplash.com/photo-1789110519554-bdca2e4549e5?w=800&q=80&fit=crop' },
  { sub: 'chinos', photo: 'https://images.unsplash.com/photo-1711443813147-def27861b9af?w=800&q=80&fit=crop' },
  { sub: 'shorts', photo: 'https://images.unsplash.com/photo-1789110853603-11504d948dde?w=800&q=80&fit=crop' },
  { sub: 'skirt', photo: 'https://images.unsplash.com/photo-1678300410347-fc1accb1b19b?w=800&q=80&fit=crop' },
  { sub: 'day_dress', photo: 'https://images.unsplash.com/photo-1622738336927-7584b695fc88?w=800&q=80&fit=crop' },
  { sub: 'leggings', photo: 'https://images.unsplash.com/photo-1789111161057-90c5ce12dc21?w=800&q=80&fit=crop' },
  { sub: 'sneakers', photo: 'https://images.unsplash.com/photo-1777339862772-d6d3ed390efa?w=800&q=80&fit=crop' },
  { sub: 'loafers', photo: 'https://images.unsplash.com/photo-1777987601447-266e128de448?w=800&q=80&fit=crop' },
  { sub: 'heels', photo: 'https://images.unsplash.com/photo-1520095570847-5d121452cd39?w=800&q=80&fit=crop' },
  { sub: 'boots', photo: 'https://images.unsplash.com/photo-1605732440685-d0654d81aa30?w=800&q=80&fit=crop' },
  { sub: 'flats', photo: 'https://images.unsplash.com/photo-1712512343634-f64161d3daa6?w=800&q=80&fit=crop' },
  { sub: 'tote', photo: 'https://images.unsplash.com/photo-1624687943971-e86af76d57de?w=800&q=80&fit=crop' },
  { sub: 'crossbody', photo: 'https://images.unsplash.com/photo-1620786514684-ff35b5aae55e?w=800&q=80&fit=crop' },
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
  { sub: 'coat', photo: 'https://images.unsplash.com/photo-1635097247472-dfc3e652db97?w=800&q=80&fit=crop' },
  { sub: 'puffer', photo: 'https://images.unsplash.com/photo-1611025504703-8c143abe6996?w=800&q=80&fit=crop' },
  { sub: 'jeans', photo: 'https://images.unsplash.com/photo-1714143164139-8fdc14bf3054?w=800&q=80&fit=crop' },
  { sub: 'chinos', photo: 'https://images.unsplash.com/photo-1789238052416-d6c439162025?w=800&q=80&fit=crop' },
  { sub: 'trousers', photo: 'https://images.unsplash.com/photo-1774294071542-693880887e6c?w=800&q=80&fit=crop' },
  { sub: 'joggers', photo: 'https://images.unsplash.com/photo-1691407981600-62ebb537a0f2?w=800&q=80&fit=crop' },
  { sub: 'sneakers', photo: 'https://images.unsplash.com/photo-1777339862772-d6d3ed390efa?w=800&q=80&fit=crop' },
  { sub: 'loafers', photo: 'https://images.unsplash.com/photo-1676121270762-47c8d3a7b9d5?w=800&q=80&fit=crop' },
  { sub: 'boots', photo: 'https://images.unsplash.com/photo-1614213908010-49bdfedbca32?w=800&q=80&fit=crop' },
  { sub: 'briefcase', photo: 'https://images.unsplash.com/photo-1654773215728-4387196bc2a8?w=800&q=80&fit=crop' },
  { sub: 'tote', photo: 'https://images.unsplash.com/photo-1574365569389-a10d488ca3fb?w=800&q=80&fit=crop' },
  { sub: 'belt', photo: 'https://images.unsplash.com/photo-1786553283657-4b080ff5c103?w=800&q=80&fit=crop' },
];
