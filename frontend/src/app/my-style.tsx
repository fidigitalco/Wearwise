import { router, useFocusEffect } from 'expo-router';
import { Minus, Plus, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { BottomSheet, useToast } from '../components/Overlays';
import { Chip, ChipWrap, FormScroll } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n, useLabel } from '../lib/i18n';
import { rgbCss, useMeta } from '../lib/meta';
import { errorMessage, smartShop, type StyleProfile } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';
import type { User } from '../types';

const REVIEW_STEPS = [0, 50, 100, 200, 500, 1000];
const NEVER_COLORS = ['black', 'white', 'grey', 'navy', 'blue', 'green', 'olive', 'beige', 'brown', 'burgundy', 'red', 'pink', 'purple', 'yellow', 'orange', 'mustard'];
const NEVER_TYPES = ['t_shirt', 'shirt', 'blouse', 'hoodie', 'sweater', 'jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'day_dress', 'jumpsuit', 'blazer', 'puffer', 'sneakers', 'heels', 'boots', 'sandals'];

/** My style (build prompt §2.2): what WearWise has learned, and every knob that shapes search, editable. */
export default function MyStyleScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const meta = useMeta();
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [adding, setAdding] = useState(false);

  useFocusEffect(useCallback(() => {
    smartShop.style().then(setProfile).catch((e) => toast(errorMessage(e), 'error'));
  }, [toast]));

  const save = async (patch: Partial<User>) => {
    try {
      await updateUser(patch);
      setProfile(await smartShop.style());
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const never = user?.never_list ?? [];
  const toggleNever = (token: string) =>
    save({ never_list: never.includes(token) ? never.filter((x) => x !== token) : [...never, token] });
  const neverLabel = (token: string) => {
    const [kind, value = ''] = token.split(':');
    return kind === 'color' ? label('colors', value) : kind === 'sub' ? label('subcategories', value)
      : kind === 'style' ? label('styles', value) : value.replace(/_/g, ' ');
  };
  const minRating = user?.min_rating ?? 4.2;
  const minReviews = user?.min_reviews ?? 200;
  const stores = user?.stores ?? [];
  // Sizes and budget in the person's language, not the stored keys ("top M").
  const sizeLabels: Record<string, string> = {
    top: s.prefs.sizeTop, bottom: s.prefs.sizeBottom, shoes: s.prefs.sizeShoes, jacket: s.onb.jacket, length: s.onb.length, drop: s.onb.drop,
  };
  const sizeRows = Object.entries(profile?.sizes ?? {}).filter(([k, v]) => v && sizeLabels[k]).map(([k, v]) => [sizeLabels[k], v] as const);
  const budget = (profile?.budget_ranges ?? []).map((b) => s.onb.budgets[b] ?? b).join(', ');

  return (
    <FormScroll style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      <Section title={s.myStyle.axes}>
        {profile?.axes.length ? profile.axes.map((a) => (
          <View key={a.style} style={{ gap: 4 }}>
            <View style={styles.between}>
              <Text style={[type.body, { color: t.text }]}>{label('styles', a.style)}</Text>
              <Text style={[type.bodyStrong, { color: t.text }]}>{a.score}%</Text>
            </View>
            <View style={[styles.bar, { backgroundColor: t.cardAlt }]}>
              <View style={[styles.barFill, { width: `${a.score}%`, backgroundColor: t.primary }]} />
            </View>
          </View>
        )) : <Text style={[type.body, { color: t.textMuted }]}>{s.myStyle.empty}</Text>}
        <Pressable onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })} accessibilityRole="button" hitSlop={8}>
          <Text style={[type.bodyStrong, { color: t.primary }]}>{s.myStyle.retrain}</Text>
        </Pressable>
      </Section>

      {profile?.palette.length ? (
        <Section title={s.myStyle.palette}>
          <View style={styles.swatches}>
            {profile.palette.map((c) => (
              <View key={c} accessibilityLabel={label('colors', c)} style={[styles.swatch, { backgroundColor: rgbCss(meta.colors[c]), borderColor: t.border }]} />
            ))}
          </View>
        </Section>
      ) : null}

      {profile?.liked.length ? (
        <Section title={s.myStyle.liked}>
          <ChipWrap>{profile.liked.map((x) => <Chip key={x} label={label('subcategories', x)} />)}</ChipWrap>
        </Section>
      ) : null}

      <Section title={s.myStyle.never}>
        {never.length ? (
          <View style={styles.chips}>
            {never.map((token) => (
              <Pressable key={token} onPress={() => toggleNever(token)} accessibilityRole="button" accessibilityLabel={`${neverLabel(token)}, remove`}
                style={[styles.neverChip, { borderColor: t.danger }]}>
                <Text style={[type.caption, { color: t.danger, fontWeight: '600' }]}>{neverLabel(token)}</Text>
                <X size={13} color={t.danger} />
              </Pressable>
            ))}
          </View>
        ) : <Text style={[type.body, { color: t.textMuted }]}>{s.myStyle.neverEmpty}</Text>}
        <Pressable onPress={() => setAdding(true)} accessibilityRole="button" hitSlop={8}>
          <Text style={[type.bodyStrong, { color: t.primary }]}>+ {s.myStyle.neverAdd}</Text>
        </Pressable>
      </Section>

      <Section title={s.myStyle.quality}>
        <Stepper label={s.myStyle.minRating} value={`${minRating.toFixed(1)} ★`}
          onMinus={() => save({ min_rating: Math.max(3, Math.round((minRating - 0.1) * 10) / 10) })}
          onPlus={() => save({ min_rating: Math.min(4.9, Math.round((minRating + 0.1) * 10) / 10) })} />
        <Stepper label={s.myStyle.minReviews} value={String(minReviews)}
          onMinus={() => save({ min_reviews: [...REVIEW_STEPS].reverse().find((x) => x < minReviews) ?? 0 })}
          onPlus={() => save({ min_reviews: REVIEW_STEPS.find((x) => x > minReviews) ?? minReviews })} />
        <View style={styles.between}>
          <Text style={[type.body, { color: t.text, flex: 1 }]}>{s.myStyle.hideSponsored}</Text>
          <Switch value={user?.hide_sponsored ?? true} onValueChange={(v) => save({ hide_sponsored: v })}
            trackColor={{ true: t.primary, false: t.border }} thumbColor={t.card} ios_backgroundColor={t.border}
            accessibilityLabel={s.myStyle.hideSponsored} />
        </View>
      </Section>

      <Section title={s.myStyle.stores}>
        <ChipWrap>
          {(profile?.all_stores ?? []).map((st) => (
            <Chip key={st} label={st} selected={stores.includes(st)}
              onPress={() => save({ stores: stores.includes(st) ? stores.filter((x) => x !== st) : [...stores, st] })} />
          ))}
        </ChipWrap>
      </Section>

      <Section title={s.myStyle.sizes}>
        {sizeRows.length || budget ? (
          <View style={{ gap: space.xs }}>
            {sizeRows.map(([k, v]) => (
              <View key={k} style={styles.between}>
                <Text style={[type.body, { color: t.textSub }]}>{k}</Text>
                <Text style={[type.bodyStrong, { color: t.text }]}>{v}</Text>
              </View>
            ))}
            {budget ? (
              <View style={styles.between}>
                <Text style={[type.body, { color: t.textSub }]}>{s.myStyle.budget}</Text>
                <Text style={[type.bodyStrong, { color: t.text, flexShrink: 1, textAlign: 'right' }]}>{budget}</Text>
              </View>
            ) : null}
          </View>
        ) : <Text style={[type.body, { color: t.textMuted }]}>—</Text>}
        <Pressable onPress={() => router.push('/preferences')} accessibilityRole="button" hitSlop={8}>
          <Text style={[type.bodyStrong, { color: t.primary }]}>{s.myStyle.edit}</Text>
        </Pressable>
      </Section>

      <BottomSheet visible={adding} onClose={() => setAdding(false)} title={s.myStyle.never} closeLabel={s.common.close}>
        <Text style={[type.overline, { color: t.textMuted }]}>{s.myStyle.neverColors}</Text>
        <ChipWrap>
          {NEVER_COLORS.map((c) => (
            <Chip key={c} label={label('colors', c)} swatch={rgbCss(meta.colors[c])} selected={never.includes(`color:${c}`)} onPress={() => toggleNever(`color:${c}`)} />
          ))}
        </ChipWrap>
        <Text style={[type.overline, { color: t.textMuted }]}>{s.myStyle.neverTypes}</Text>
        <ChipWrap>
          {NEVER_TYPES.map((x) => (
            <Chip key={x} label={label('subcategories', x)} selected={never.includes(`sub:${x}`)} onPress={() => toggleNever(`sub:${x}`)} />
          ))}
        </ChipWrap>
      </BottomSheet>
    </FormScroll>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: t.border }]}>
      <Text style={[type.overline, { color: t.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.between}>
      <Text style={[type.body, { color: t.text, flex: 1 }]}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={onMinus} accessibilityRole="button" accessibilityLabel={`${label} −`} hitSlop={8} style={[styles.stepBtn, { borderColor: t.border }]}>
          <Minus size={16} color={t.text} />
        </Pressable>
        <Text style={[type.bodyStrong, { color: t.text, minWidth: 56, textAlign: 'center' }]}>{value}</Text>
        <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel={`${label} +`} hitSlop={8} style={[styles.stepBtn, { borderColor: t.border }]}>
          <Plus size={16} color={t.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.xl, paddingBottom: space.xxl * 2 },
  section: { borderTopWidth: 1, paddingTop: space.lg, gap: space.md },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  swatches: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  neverChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
