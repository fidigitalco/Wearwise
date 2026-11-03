/** WearWise Premium prices shown in the app (store billing is not connected yet). */
export const PRICING = { currency: '$', monthly: 4.99, yearly: 29.99 };

export const formatPrice = (v: number) => `${PRICING.currency}${v.toFixed(2)}`;

/** How much the yearly plan saves against twelve monthly payments, in whole percent. */
export const yearlySavings = () => Math.round((1 - PRICING.yearly / (PRICING.monthly * 12)) * 100);
