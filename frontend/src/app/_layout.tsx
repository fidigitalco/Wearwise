import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '../components/Overlays';
import { AuthProvider, useAuth } from '../lib/auth';
import { I18nProvider, useI18n } from '../lib/i18n';
import { useTheme } from '../theme';

const PUBLIC = new Set(['welcome', 'auth']);

function AuthGate() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const t = useTheme();
  const { t: s } = useI18n();

  useEffect(() => {
    if (!ready) return;
    const first = segments[0] as string | undefined;
    const isPublic = first !== undefined && PUBLIC.has(first);
    if (!user && !isPublic) router.replace('/welcome');
    else if (user && !user.onboarded && first !== 'onboarding') router.replace('/onboarding');
    // Onboarding navigates on by itself when it finishes, so it is not redirected here.
    // A guest may open the sign-up screen; everyone else signed in is sent home.
    else if (user && isPublic && !(user.is_guest && first === 'auth')) router.replace('/');
  }, [user, ready, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        // iOS 26+ makes Stack headers transparent by default; the screens are
        // plain ScrollViews, so keep the header solid rather than overlapping them.
        headerTransparent: false,
        contentStyle: { backgroundColor: t.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="garment/new" options={{ title: s.titles.addPiece, presentation: 'modal' }} />
      <Stack.Screen name="garment/[id]" options={{ title: '' }} />
      <Stack.Screen name="outfit/[id]" options={{ title: '' }} />
      <Stack.Screen name="outfit/check" options={{ title: s.titles.check }} />
      <Stack.Screen name="assistant" options={{ title: s.assistant.title }} />
      <Stack.Screen name="search" options={{ title: s.search.title }} />
      <Stack.Screen name="saved" options={{ title: s.saved.title }} />
      <Stack.Screen name="calendar" options={{ title: s.calendar.title }} />
      <Stack.Screen name="tour" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="premium" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="preferences" options={{ title: s.prefs.title }} />
      <Stack.Screen name="inspiration" options={{ title: s.inspo.title }} />
      <Stack.Screen name="wishlist" options={{ title: s.wishlist.title }} />
      <Stack.Screen name="shop" options={{ title: s.shop.screen }} />
      <Stack.Screen name="feedback" options={{ title: s.feedback.title }} />
    </Stack>
  );
}

/**
 * On launch, look for a newer over-the-air update and switch to it at once,
 * instead of waiting for the next cold start (the default). Skipped in
 * development and when updates are off; a failed check never blocks the app.
 */
function useApplyUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    Updates.checkForUpdateAsync()
      .then((r) => (r.isAvailable ? Updates.fetchUpdateAsync() : null))
      .then((f) => (f?.isNew ? Updates.reloadAsync() : undefined))
      .catch(() => {});
  }, []);
}

export default function RootLayout() {
  const t = useTheme();
  useApplyUpdates();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>
              <StatusBar style={t.isDark ? 'light' : 'dark'} />
              <AuthGate />
            </ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
