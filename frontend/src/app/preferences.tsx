import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvatarEditor } from '../components/AvatarEditor';
import { useToast } from '../components/Overlays';
import { AboutSection, AboutYouSection, SizesSection, StylesSection, prefsFromUser, prefsToPatch, type Prefs } from '../components/PrefsSections';
import { Button, FormScroll } from '../components/ui';
import { useAuth } from '../lib/auth';
import { DEFAULT_AVATAR, loadAvatar, saveAvatar, type AvatarProfile } from '../lib/avatar';
import { useI18n } from '../lib/i18n';
import { errorMessage } from '../services/api';
import { gutter, space, useTheme } from '../theme';

/** The avatar, about you, sizes, and everything onboarding asked: styles, wardrobe, occasions, colours, units. One Save for all. */
export default function PreferencesScreen() {
  const t = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { t: s } = useI18n();
  const { user, updateUser } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(prefsFromUser(user));
  const [saving, setSaving] = useState(false);
  // Face and skin tone stay on the phone; height and weight are part of prefs.
  const [avatar, setAvatar] = useState<AvatarProfile>(DEFAULT_AVATAR);

  useEffect(() => {
    loadAvatar().then(setAvatar);
  }, []);

  const save = async () => {
    if (!prefs.preferred_styles.length) {
      toast(s.prefs.pickOne, 'error');
      return;
    }
    setSaving(true);
    try {
      await saveAvatar(avatar);
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
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <FormScroll contentContainerStyle={styles.wrap}>
        <AvatarEditor avatar={avatar} heightCm={prefs.height_cm} weightKg={prefs.weight_kg}
          onChange={(patch) => setAvatar((a) => ({ ...a, ...patch }))} />
        <AboutYouSection prefs={prefs} onChange={setPrefs} />
        <SizesSection prefs={prefs} onChange={setPrefs} />
        <StylesSection prefs={prefs} onChange={setPrefs} />
        <AboutSection prefs={prefs} onChange={setPrefs} />
      </FormScroll>
      <View style={[styles.footer, { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: insets.bottom + space.sm }]}>
        <Button title={s.common.save} onPress={save} loading={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.xxl, paddingBottom: space.xxl },
  footer: { paddingHorizontal: gutter, paddingTop: space.sm, borderTopWidth: 1 },
});
