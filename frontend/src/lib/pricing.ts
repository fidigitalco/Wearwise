/** WearWise Premium prices shown in the app (store billing is not connected yet). */
// $2.99 a month (owner's decision, 2026-11-19) with a 7-day trial; yearly $19.99.
export const PRICING = { currency: '$', monthly: 2.99, yearly: 19.99, colorAnalysis: 4.99 };

export const formatPrice = (v: number) => `${PRICING.currency}${v.toFixed(2)}`;

/** How much the yearly plan saves against twelve monthly payments, in whole percent. */
export const yearlySavings = () => Math.round((1 - PRICING.yearly / (PRICING.monthly * 12)) * 100);
