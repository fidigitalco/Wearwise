import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../components/Overlays';
import { AboutSection, SizesSection, StylesSection, prefsFromUser, prefsToPatch, type Prefs } from '../components/PrefsSections';
import { Button } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { errorMessage } from '../services/api';
import { gutter, space, useTheme } from '../theme';

/** Edit everything onboarding asked: styles, wardrobe, occasions, colours, sizes, units. */
export default function PreferencesScreen() {
  const t = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { t: s } = useI18n();
  const { user, updateUser } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(prefsFromUser(user));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!prefs.preferred_styles.length) {
      toast(s.prefs.pickOne, 'error');
      return;
    }
    setSaving(true);
    try {
      await updateUser(prefsToPatch(prefs));
      toast(s.prefs.saved);
      router.back();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <StylesSection prefs={prefs} onChange={setPrefs} />
        <AboutSection prefs={prefs} onChange={setPrefs} />
        <SizesSection prefs={prefs} onChange={setPrefs} />
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: insets.bottom + space.sm }]}>
        <Button title={s.common.save} onPress={save} loading={saving} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.xxl, paddingBottom: space.xxl },
  footer: { paddingHorizontal: gutter, paddingTop: space.sm, borderTopWidth: 1 },
});
