import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Hanger } from '../components/icons';
import { useToast } from '../components/Overlays';
import { Tour } from '../components/Tour';
import { Button } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { errorMessage } from '../services/api';
import { gutter, space, type, useTheme } from '../theme';

/** First screen for a signed-out visitor: a short tour of what WearWise does, then sign up, sign in or look around as a guest. */
export default function WelcomeScreen() {
  const t = useTheme();
  const toast = useToast();
  const { t: s } = useI18n();
  const { continueAsGuest } = useAuth();
  const [busy, setBusy] = useState(false);

  const guest = async () => {
    setBusy(true);
    try {
      // The auth gate takes a signed-in guest straight to Today.
      await continueAsGuest();
    } catch (e) {
      toast(errorMessage(e), 'error');
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: t.highlightBg }]}>
          <Hanger size={22} color={t.primary} />
        </View>
        <Text style={[type.subtitle, { color: t.text }]}>{s.welcome.brand}</Text>
      </View>

      <View style={{ flex: 1, paddingVertical: space.lg }}>
        <Tour />
      </View>

      <View style={styles.actions}>
        <Button title={s.welcome.signUp} onPress={() => router.push({ pathname: '/auth', params: { mode: 'up' } })} />
        <Button title={s.welcome.guest} variant="secondary" loading={busy} onPress={guest} />
        <Button title={s.welcome.haveAccount} variant="ghost" onPress={() => router.push({ pathname: '/auth', params: { mode: 'in' } })} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: gutter, paddingTop: space.md },
  logo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingHorizontal: gutter, paddingBottom: space.lg, gap: space.sm },
});
