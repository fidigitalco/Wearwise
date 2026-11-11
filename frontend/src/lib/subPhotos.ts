// Generated from the demo catalogue's photos: subcategory → colour → photo
// ('_' when the colour is unknown). Lets suggestion cards show a real garment.
const PHOTOS: Record<string, Record<string, string>> = {
  "cardigan": {
    "beige": "https://images.unsplash.com/photo-1683315565563-f72590773805?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1683315565563-f72590773805?w=800&q=80&fit=crop"
  },
  "jeans": {
    "navy": "https://images.unsplash.com/photo-1714143164072-7646ef5cb24d?w=800&q=80&fit=crop",
    "light_blue": "https://images.unsplash.com/photo-1789110854969-94d36ba7636e?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1789110854969-94d36ba7636e?w=800&q=80&fit=crop"
  },
  "shirt": {
    "cream": "https://images.unsplash.com/photo-1752825609278-f9696bc9d7bd?w=800&q=80&fit=crop",
    "white": "https://images.unsplash.com/photo-1603252109303-2751441dd157?w=800&q=80&fit=crop",
    "light_blue": "https://images.unsplash.com/photo-1791391279730-4756da7b4608?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1752825609278-f9696bc9d7bd?w=800&q=80&fit=crop"
  },
  "skirt": {
    "burgundy": "https://images.unsplash.com/photo-1678300410347-fc1accb1b19b?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1678300410347-fc1accb1b19b?w=800&q=80&fit=crop"
  },
  "loafers": {
    "brown": "https://images.unsplash.com/photo-1777987601447-266e128de448?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1777987601447-266e128de448?w=800&q=80&fit=crop"
  },
  "sweater": {
    "cream": "https://images.unsplash.com/photo-1643015862949-5c8d15a4242e?w=800&q=80&fit=crop",
    "brown": "https://images.unsplash.com/photo-1773747310662-e7cc9e681226?w=800&q=80&fit=crop",
    "grey": "https://images.unsplash.com/photo-1636146049394-0924c2b66104?w=800&q=80&fit=crop",
    "navy": "https://images.unsplash.com/photo-1611312449545-94176309c857?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1773747310662-e7cc9e681226?w=800&q=80&fit=crop"
  },
  "trousers": {
    "charcoal": "https://images.unsplash.com/photo-1783120947592-5b3094cd805f?w=800&q=80&fit=crop",
    "black": "https://images.unsplash.com/photo-1789110519554-bdca2e4549e5?w=800&q=80&fit=crop",
    "khaki": "https://images.unsplash.com/photo-1691407981600-62ebb537a0f2?w=800&q=80&fit=crop",
    "grey": "https://images.unsplash.com/photo-1774294071542-693880887e6c?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1789110519554-bdca2e4549e5?w=800&q=80&fit=crop"
  },
  "sneakers": {
    "white": "https://images.unsplash.com/photo-1777339862772-d6d3ed390efa?w=800&q=80&fit=crop",
    "grey": "https://images.unsplash.com/photo-1719523677291-a395426c1a87?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1777339862772-d6d3ed390efa?w=800&q=80&fit=crop"
  },
  "tote": {
    "brown": "https://images.unsplash.com/photo-1624687943971-e86af76d57de?w=800&q=80&fit=crop",
    "cream": "https://images.unsplash.com/photo-1574365569389-a10d488ca3fb?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1624687943971-e86af76d57de?w=800&q=80&fit=crop"
  },
  "boots": {
    "black": "https://images.unsplash.com/photo-1605732440685-d0654d81aa30?w=800&q=80&fit=crop",
    "brown": "https://images.unsplash.com/photo-1575425939273-46ecee6d6931?w=800&q=80&fit=crop",
    "camel": "https://images.unsplash.com/photo-1635665808369-ac373379a5b4?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1605732440685-d0654d81aa30?w=800&q=80&fit=crop"
  },
  "blazer": {
    "beige": "https://images.unsplash.com/photo-1749096291416-2c5e0f19a815?w=800&q=80&fit=crop",
    "navy": "https://images.unsplash.com/photo-1740710748146-a15d840d6f40?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1749096291416-2c5e0f19a815?w=800&q=80&fit=crop"
  },
  "coat": {
    "camel": "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=800&q=80&fit=crop"
  },
  "t_shirt": {
    "navy": "https://images.unsplash.com/photo-1624124959348-86710fef6630?w=800&q=80&fit=crop",
    "white": "https://images.unsplash.com/photo-1620799139507-2a76f79a2f4d?w=800&q=80&fit=crop",
    "black": "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1620799139507-2a76f79a2f4d?w=800&q=80&fit=crop"
  },
  "day_dress": {
    "pink": "https://images.unsplash.com/photo-1622738336927-7584b695fc88?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1622738336927-7584b695fc88?w=800&q=80&fit=crop"
  },
  "trench": {
    "beige": "https://images.unsplash.com/photo-1722859031306-4c81e8d83957?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1722859031306-4c81e8d83957?w=800&q=80&fit=crop"
  },
  "puffer": {
    "black": "https://images.unsplash.com/photo-1611025504703-8c143abe6996?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1611025504703-8c143abe6996?w=800&q=80&fit=crop"
  },
  "jacket": {
    "black": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80&fit=crop",
    "olive": "https://images.unsplash.com/photo-1579592610812-49855d94db0d?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80&fit=crop"
  },
  "shorts": {
    "beige": "https://images.unsplash.com/photo-1789110853603-11504d948dde?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1789110853603-11504d948dde?w=800&q=80&fit=crop"
  },
  "flats": {
    "black": "https://images.unsplash.com/photo-1712512343634-f64161d3daa6?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1712512343634-f64161d3daa6?w=800&q=80&fit=crop"
  },
  "heels": {
    "beige": "https://images.unsplash.com/photo-1520095570847-5d121452cd39?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1520095570847-5d121452cd39?w=800&q=80&fit=crop"
  },
  "sandals": {
    "brown": "https://images.unsplash.com/photo-1613662632164-7f2b081a5b46?w=800&q=80&fit=crop"
  },
  "crossbody": {
    "black": "https://images.unsplash.com/photo-1620786514684-ff35b5aae55e?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1620786514684-ff35b5aae55e?w=800&q=80&fit=crop"
  },
  "clutch": {
    "burgundy": "https://images.unsplash.com/photo-1749294435694-ce3c586591e6?w=800&q=80&fit=crop"
  },
  "belt": {
    "black": "https://images.unsplash.com/photo-1786553283657-4b080ff5c103?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1786553283657-4b080ff5c103?w=800&q=80&fit=crop"
  },
  "hoodie": {
    "grey": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80&fit=crop"
  },
  "leggings": {
    "black": "https://images.unsplash.com/photo-1789111161057-90c5ce12dc21?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1789111161057-90c5ce12dc21?w=800&q=80&fit=crop"
  },
  "blouse": {
    "white": "https://images.unsplash.com/photo-1783700550072-1cc66ff4a947?w=800&q=80&fit=crop",
    "cream": "https://images.unsplash.com/photo-1718278866206-368c2a7f1cfa?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1783700550072-1cc66ff4a947?w=800&q=80&fit=crop"
  },
  "polo": {
    "navy": "https://images.unsplash.com/photo-1717127036020-83774f354008?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1717127036020-83774f354008?w=800&q=80&fit=crop"
  },
  "chinos": {
    "beige": "https://images.unsplash.com/photo-1711443813147-def27861b9af?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1711443813147-def27861b9af?w=800&q=80&fit=crop"
  },
  "briefcase": {
    "brown": "https://images.unsplash.com/photo-1654773215728-4387196bc2a8?w=800&q=80&fit=crop",
    "_": "https://images.unsplash.com/photo-1654773215728-4387196bc2a8?w=800&q=80&fit=crop"
  },
  "joggers": {
    "_": "https://images.unsplash.com/photo-1691407981600-62ebb537a0f2?w=800&q=80&fit=crop"
  }
};

/** A real photo of the piece: the same colour when we have one, else any of that type. */
export function subPhoto(sub?: string | null, color?: string | null): string | null {
  const byColor = sub ? PHOTOS[sub] : undefined;
  if (!byColor) return null;
  return (color && byColor[color]) || byColor._ || Object.values(byColor)[0] || null;
}
