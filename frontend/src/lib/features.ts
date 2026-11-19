/**
 * Features switched off for now without removing their code. Flip back to true to bring one back
 * (it ships with an OTA update).
 *  - wardrobe: the closet (adding pieces, building outfits from it, closet-based shopping). The screens
 *    stay; only the ways in are hidden.
 *  - yearlyPlan: the yearly Premium plan; only the monthly one is offered.
 */
export const FEATURES = { wardrobe: false, yearlyPlan: false } as const;
