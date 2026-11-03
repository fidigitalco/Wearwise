import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../components/Overlays';
import { AboutSection, StylesSection, prefsFromUser, prefsToPatch, type Prefs } from '../components/PrefsSections';
import { Button } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { errorMessage } from '../services/api';
import { gutter, space, type, useTheme } from '../theme';

const STEPS = 2;

/**
 * First run, right after sign-up: two short, skippable steps (styles, then
 * wardrobe, occasions and colours); sizes, units and language live in Profile.
 * Then straight on to adding clothes.
 */
export default function OnboardingScreen() {
  const t = useTheme();
  const toast = useToast();
  const { t: s } = useI18n();
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<Prefs>(prefsFromUser(user));
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      await updateUser({ ...prefsToPatch(prefs), onboarded: true });
      // Next step of the journey: the wardrobe is empty, so start filling it.
      router.replace('/closet');
      router.push('/garment/new');
    } catch (e) {
      toast(errorMessage(e), 'error');
      setSaving(false);
    }
  };

  const next = () => (step < STEPS - 1 ? setStep(step + 1) : finish());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.top}>
        <View style={styles.progress}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i <= step ? t.primary : t.border }]} />
          ))}
        </View>
        <Pressable onPress={next} hitSlop={10} accessibilityRole="button">
          <Text style={[type.bodyStrong, { color: t.textSub }]}>{s.prefs.skip}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={[type.label, { color: t.textMuted }]}>{s.onboarding.step(step + 1, STEPS)}</Text>
        {step === 0 ? <StylesSection prefs={prefs} onChange={setPrefs} /> : null}
        {step === 1 ? <AboutSection prefs={prefs} onChange={setPrefs} /> : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.card }]}>
        {step > 0 ? <Button title={s.onboarding.back} variant="secondary" style={{ flex: 1 }} onPress={() => setStep(step - 1)} /> : null}
        <Button title={step < STEPS - 1 ? s.onboarding.next : s.onboarding.finish} style={{ flex: 2 }} loading={saving} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: gutter, paddingTop: space.md },
  progress: { flex: 1, flexDirection: 'row', gap: space.sm },
  dot: { flex: 1, height: 4, borderRadius: 2 },
  wrap: { paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.xl, paddingBottom: space.xxl },
  footer: { flexDirection: 'row', gap: space.md, paddingHorizontal: gutter, paddingVertical: space.md, borderTopWidth: 1 },
});
