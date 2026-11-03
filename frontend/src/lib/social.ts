import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { auth } from '../services/api';

/**
 * Sign in with Apple / Google. Each returns the provider's identity token
 * (verified by the server) or null when the person backs out.
 *
 * Apple is native on iOS (Expo Go included) and goes through Apple's web flow
 * elsewhere: a browser sign-in that the server's callback returns from. Google
 * needs a development build (its native module is not in Expo Go) and
 * EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.
 */
export type SocialResult = { idToken: string; name?: string } | null;

export class SocialUnavailable extends Error {
  constructor(public reason: 'expo_go' | 'not_configured' | 'apple_not_configured') {
    super(reason);
  }
}

const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Apple's web sign-in in a browser tab; the server's callback sends the token back to `returnUrl`. */
async function signInWithAppleWeb(): Promise<SocialResult> {
  // The auth screen's own link, so the return never lands on a missing route.
  const returnUrl = Linking.createURL('auth');
  let url: string;
  try {
    url = await auth.appleStart(returnUrl);
  } catch (e: any) {
    if (e?.response?.data?.code === 'not_configured') throw new SocialUnavailable('apple_not_configured');
    throw e;
  }
  const res = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  if (res.type !== 'success') return null;
  const q = Linking.parse(res.url).queryParams ?? {};
  const idToken = typeof q.id_token === 'string' ? q.id_token : null;
  if (!idToken) return null;
  return { idToken, name: typeof q.name === 'string' ? q.name : undefined };
}

export async function signInWithApple(): Promise<SocialResult> {
  if (Platform.OS !== 'ios') return signInWithAppleWeb();
  const Apple = await import('expo-apple-authentication');
  if (!(await Apple.isAvailableAsync())) return signInWithAppleWeb();
  try {
    const c = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
    });
    if (!c.identityToken) return null;
    // Apple shares the name only on the very first sign-in.
    const name = [c.fullName?.givenName, c.fullName?.familyName].filter(Boolean).join(' ');
    return { idToken: c.identityToken, name: name || undefined };
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}

let googleConfigured = false;

export async function signInWithGoogle(): Promise<SocialResult> {
  if (inExpoGo) throw new SocialUnavailable('expo_go');
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw new SocialUnavailable('not_configured');
  // Loaded lazily: importing the native module at startup would crash Expo Go.
  const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId, iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined });
    googleConfigured = true;
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res) || !res.data.idToken) return null;
  return { idToken: res.data.idToken, name: res.data.user.name ?? undefined };
}
