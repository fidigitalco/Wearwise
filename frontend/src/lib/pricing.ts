/** WearWise Premium prices shown in the app (store billing is not connected yet). */
// Build prompt v1: $5.99 a month with a 7-day trial; the yearly price is still the MVP's until decided.
export const PRICING = { currency: '$', monthly: 5.99, yearly: 19.99, colorAnalysis: 4.99 };

export const formatPrice = (v: number) => `${PRICING.currency}${v.toFixed(2)}`;

/** How much the yearly plan saves against twelve monthly payments, in whole percent. */
export const yearlySavings = () => Math.round((1 - PRICING.yearly / (PRICING.monthly * 12)) * 100);
