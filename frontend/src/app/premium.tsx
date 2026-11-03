import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../components/Overlays';
import { Button } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { formatPrice, PRICING, yearlySavings } from '../lib/pricing';
import { gutter, radius, space, type, useTheme } from '../theme';

const HERO = [
  require('../../assets/images/style-smart_casual.jpg'),
  require('../../assets/images/style-minimal.jpg'),
  require('../../assets/images/style-classic.jpg'),
];

type Plan = 'year' | 'month';

function PlanCard({
  on, title, note, amount, badge, onPress,
}: { on: boolean; title: string; note: string; amount: string; badge?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${title}, ${amount}`}
      onPress={onPress}
      style={[styles.plan, on ? { borderWidth: 2, borderColor: t.text, backgroundColor: t.highlightBg } : { borderWidth: 1, borderColor: t.border, backgroundColor: t.card }]}
    >
      <View style={[styles.radio, on ? { borderWidth: 7, borderColor: t.text } : { borderWidth: 1.5, borderColor: t.textSecondary }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: t.text, fontSize: 16 }]}>{title}</Text>
        <Text style={[type.label, { color: t.textMuted }]}>{note}</Text>
      </View>
      <Text style={[type.bodyStrong, { color: t.text, fontSize: 16 }]}>{amount}</Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: t.primary }]}>
          <Text style={[type.caption, { color: t.onPrimary, fontWeight: '600' }]}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** WearWise Premium: monthly and yearly plans. Store billing is not connected yet, so subscribing only says so. */
export default function PremiumScreen() {
  const t = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { t: s } = useI18n();
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan>('year');
  const save = yearlySavings();
  const price = plan === 'year' ? `${formatPrice(PRICING.yearly)} ${s.premium.perYear}` : `${formatPrice(PRICING.monthly)} ${s.premium.perMonth}`;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={{ flex: 1, backgroundColor: t.card }}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.lg }} bounces={false}>
        <View style={styles.hero}>
          {HERO.map((src, i) => (
            <Image key={i} source={src} style={styles.heroImage} contentFit="cover" />
          ))}
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={s.premium.close} hitSlop={8}
            style={[styles.close, { top: insets.top + space.sm, backgroundColor: t.frosted }]}>
            <X size={20} color={t.text} />
          </Pressable>
        </View>

        <View style={[styles.body, { backgroundColor: t.card }]}>
          <View style={{ gap: space.xs }}>
            <Text style={[type.overline, { color: t.primary }]}>{s.premium.label}</Text>
            <Text style={[type.display, { color: t.text }]} accessibilityRole="header">{s.premium.title}</Text>
            <Text style={[type.label, { color: t.textMuted }]}>
              {s.premium.currentPlan(user?.plan === 'premium' ? s.premium.premiumPlan : s.premium.freePlan)}
            </Text>
          </View>

          <View style={{ gap: space.sm }}>
            {s.premium.features.map((f) => (
              <View key={f} style={styles.feature}>
                <Check size={18} color={t.primary} strokeWidth={2.4} />
                <Text style={[type.body, { color: t.text, flex: 1 }]}>{f}</Text>
              </View>
            ))}
          </View>

          <View accessibilityRole="radiogroup" accessibilityLabel={s.premium.plans} style={{ gap: space.md, paddingTop: space.sm }}>
            <PlanCard on={plan === 'year'} onPress={() => setPlan('year')} title={s.premium.yearly} note={s.premium.yearlyNote(formatPrice(PRICING.yearly / 12))}
              amount={formatPrice(PRICING.yearly)} badge={save > 0 ? s.premium.best(save) : undefined} />
            <PlanCard on={plan === 'month'} onPress={() => setPlan('month')} title={s.premium.monthly} note={s.premium.monthlyNote} amount={formatPrice(PRICING.monthly)} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, borderTopColor: t.border, backgroundColor: t.card }]}>
        <Button title={s.premium.subscribe} onPress={() => toast(s.premium.soon)} />
        <Text style={[type.caption, { color: t.textMuted, textAlign: 'center' }]}>{s.premium.fine(price)}</Text>
        <View style={styles.links}>
          <Pressable accessibilityRole="button" hitSlop={6} onPress={() => toast(s.premium.soon)}>
            <Text style={[type.caption, { color: t.textMuted, textDecorationLine: 'underline' }]}>{s.premium.restore}</Text>
          </Pressable>
          <Text style={[type.caption, { color: t.textMuted, textDecorationLine: 'underline' }]}>{s.premium.terms}</Text>
          <Text style={[type.caption, { color: t.textMuted, textDecorationLine: 'underline' }]}>{s.premium.privacy}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 236, flexDirection: 'row', gap: 2 },
  heroImage: { flex: 1, height: '100%' },
  close: { position: 'absolute', right: space.lg, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { marginTop: -24, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: gutter, paddingTop: space.xl, gap: space.lg },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  plan: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.xl },
  radio: { width: 22, height: 22, borderRadius: 11 },
  badge: { position: 'absolute', top: -10, right: space.md, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  footer: { paddingHorizontal: gutter, paddingTop: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
});
