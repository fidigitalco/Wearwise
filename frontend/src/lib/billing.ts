import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { billing as billingApi } from '../services/api';
import type { User } from '../types';

/**
 * WearWise Premium through the App Store (StoreKit 2, expo-iap). The signed transaction goes to the
 * server, which checks Apple's signature and sets the plan (backend api/billing.py); only then is the
 * transaction finished. Google Play billing is not set up yet, so Android keeps "coming soon".
 */
export const PREMIUM_SKU = 'app.wearwise.premium.monthly';

/** In a store build on iOS; Expo Go has no StoreKit module. */
export const billingAvailable =
  Platform.OS === 'ios' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

type Iap = typeof import('expo-iap');
let connection: Promise<Iap> | null = null;

// Loaded lazily, so screens that never sell anything do not load StoreKit.
function iap(): Promise<Iap> {
  if (!connection) {
    connection = import('expo-iap').then(async (m) => {
      await m.initConnection();
      return m;
    });
    connection.catch(() => { connection = null; });
  }
  return connection;
}

/** The App Store's localized price for Premium (e.g. "$2.99", "2,99 €"), or null when unavailable. */
export async function premiumPrice(): Promise<string | null> {
  if (!billingAvailable) return null;
  try {
    const m = await iap();
    const products = await m.fetchProducts({ skus: [PREMIUM_SKU], type: 'subs' });
    const product = (products ?? []).find((p) => p.id === PREMIUM_SKU);
    return product?.displayPrice ?? null;
  } catch {
    return null;
  }
}

type Purchase = Parameters<Parameters<Iap['purchaseUpdatedListener']>[0]>[0];

async function confirm(m: Iap, purchase: Purchase): Promise<User> {
  if (!purchase.purchaseToken) throw new Error('The App Store returned no transaction.');
  const user = await billingApi.apple(purchase.purchaseToken);
  await m.finishTransaction({ purchase, isConsumable: false });
  return user;
}

/** Opens Apple's purchase sheet. Resolves with the updated user, or null when the person cancels. */
export async function buyPremium(): Promise<User | null> {
  const m = await iap();
  return new Promise<User | null>((resolve, reject) => {
    const done = () => {
      ok.remove();
      failed.remove();
    };
    const ok = m.purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== PREMIUM_SKU) return;
      done();
      confirm(m, purchase).then(resolve, reject);
    });
    const failed = m.purchaseErrorListener((error) => {
      done();
      if (error.code === m.ErrorCode.UserCancelled) resolve(null);
      else reject(error);
    });
    m.requestPurchase({ request: { apple: { sku: PREMIUM_SKU } }, type: 'subs' }).catch((e: unknown) => {
      done();
      reject(e);
    });
  });
}

/** Restore: sends any active Premium subscription on this Apple ID to the server. Null when there is none. */
export async function restorePremium(): Promise<User | null> {
  const m = await iap();
  const purchases = await m.getAvailablePurchases();
  let user: User | null = null;
  for (const p of purchases ?? []) {
    if (p.productId === PREMIUM_SKU) user = await confirm(m, p);
  }
  return user;
}
