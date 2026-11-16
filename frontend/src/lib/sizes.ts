/**
 * Sizes are stored as text, "M" or "M,L": up to three per kind, because many people wear
 * two sizes depending on the cut. The server treats a piece as fitting when any of them is
 * in stock.
 */
export const MAX_SIZES = 3;

export const sizeList = (value: string | undefined | null): string[] =>
  String(value ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/** Tap a size: add it (up to three; the oldest gives way) or take it off. Returns the stored text. */
export function toggleSize(value: string | undefined | null, size: string): string {
  const list = sizeList(value);
  const next = list.includes(size) ? list.filter((x) => x !== size) : [...list, size].slice(-MAX_SIZES);
  return next.join(',');
}

/** "M,L" → "M, L" for reading. */
export const showSizes = (value: string | undefined | null) => sizeList(value).join(', ');
