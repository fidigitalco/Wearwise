import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmationDialog, useToast } from '../components/Overlays';
import { Button, Chip, ChipWrap, Field, FormScroll, Segmented } from '../components/ui';
import { SwipeDeck } from '../components/SwipeDeck';
import { useAuth } from '../lib/auth';
import { SWIPE_MEN, SWIPE_WOMEN } from '../lib/swipeItems';
import { STYLE_COLOR, stylePhoto, stylesFor } from '../lib/styles';
import { useI18n, useLabel } from '../lib/i18n';
import { rgbCss, useMeta } from '../lib/meta';
import { errorMessage } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';
import type { User } from '../types';

const AGES = ['18-24', '25-34', '35-44', '45-54', '55+'] as const;
const COUNTRIES = ['GB', 'TR', 'AZ', 'DE', 'FR', 'US', 'AE', 'other'];
const TOPS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const EU = ['32', '34', '36', '38', '40', '42', '44', '46', '48'];
const WAIST = ['28', '29', '30', '31', '32', '33', '34', '36', '38', '40'];
const SHOES = Array.from({ length: 13 }, (_, i) => String(35 + i));
const FITS = ['slim', 'regular', 'relaxed', 'oversized'] as const;
const BUDGETS = ['u30', '30-60', '60-120', '120-250', '250+'];
const LENGTHS = ['28', '30', '32', '34', '36'];
const JACKETS_MEN = ['44', '46', '48', '50', '52', '54', '56', '58', '60'];
const DROPS = ['4', '6', '8'];
const STORES = [
  'Trendyol', 'ASOS', 'Zara', 'H&M', 'Mango', 'Amazon', 'Shein', 'Temu', 'eBay', 'AliExpress', 'Zalando', 'COS',
  'Massimo Dutti', 'Uniqlo', 'Pull&Bear', 'Bershka', 'Stradivarius', 'Nike', 'Adidas', 'Lacoste', 'Boohoo', 'Farfetch',
];


type Draft = {
  age_range: User['age_range']; gender: User['gender']; country: string; styles: string[]; love: string[]; avoid: string[];
  top: string; bottom: string; length: string; jacket: string; drop: string; shoes: string; fits: string[]; height: string;
  weight: string; typePrefs: Record<string, number>;
  budgets: string[]; stores: string[];
};

function fromUser(u: User | null): Draft {
  return {
    age_range: u?.age_range ?? '', gender: u?.gender ?? '', country: u?.country ?? '',
    styles: u?.preferred_styles ?? [], love: u?.favorite_colors ?? [], avoid: u?.avoid_colors ?? [],
    top: u?.sizes?.top ?? '', bottom: u?.sizes?.bottom ?? '', length: u?.sizes?.length ?? '', jacket: u?.sizes?.jacket ?? '',
    drop: u?.sizes?.drop ?? '', shoes: u?.sizes?.shoes ?? '',
    fits: u?.fit_preferences?.length ? u.fit_preferences : u?.fit_preference ? [u.fit_preference] : [],
    height: u?.height_cm ? String(u.height_cm) : '', weight: u?.weight_kg ? String(u.weight_kg) : '',
    typePrefs: u?.type_prefs ?? {}, budgets: u?.budget_ranges ?? [], stores: u?.stores ?? [],
  };
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * Onboarding (MVP v2 §1): five steps, about 90 seconds. About you, styles,
 * colours (love / avoid), sizes and budget. With ?edit=1 it is "Edit style
 * profile" from Profile and goes back when done.
 */
export default function OnboardingScreen() {
  const t = useTheme();
  const toast = useToast();
  const { t: s } = useI18n();
  const label = useLabel();
  const meta = useMeta();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { user, updateUser, signOut } = useAuth();
  const [ask, setAsk] = useState<'later' | 'exit' | null>(null);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(fromUser(user));
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const men = d.gender === 'male';
  const swipeItems = men ? SWIPE_MEN : SWIPE_WOMEN;
  // Stable, so the deck's answer effect does not run twice for one swipe.
  const answerSwipe = useCallback((sub: string, v: 1 | -1) => setD((x) => ({ ...x, typePrefs: { ...x.typePrefs, [sub]: v } })), []);

  const steps = [
    // Who you are first (gender, age, body), then sizes, then what you like.
    { title: s.onb.aboutTitle, sub: s.onb.aboutSub, ok: !!(d.age_range && d.gender && d.country) },
    { title: s.onb.sizesTitle, sub: s.onb.sizesSub, ok: !!(d.top && d.bottom && d.shoes && d.fits.length) },
    { title: s.onb.swipeTitle, sub: s.onb.swipeSub, ok: Object.keys(d.typePrefs).length >= Math.min(6, swipeItems.length) },
    { title: s.onb.stylesTitle, sub: s.onb.stylesSub, ok: d.styles.length > 0 },
    { title: s.onb.colorsTitle, sub: s.onb.colorsSub, ok: d.love.length > 0 },
    { title: s.onb.budgetTitle, sub: s.onb.budgetSub, ok: d.budgets.length > 0 },
  ];
  const last = step === steps.length - 1;

  const finish = async () => {
    setSaving(true);
    try {
      const height = parseInt(d.height, 10);
      const weight = parseInt(d.weight, 10);
      await updateUser({
        age_range: d.age_range, gender: d.gender, country: d.country, preferred_styles: d.styles,
        favorite_colors: d.love, avoid_colors: d.avoid,
        // Only the sizes that were picked; empty ones are left out rather than sent blank.
        sizes: Object.fromEntries(Object.entries({ top: d.top, bottom: d.bottom, length: d.length, shoes: d.shoes, jacket: d.jacket, drop: d.drop })
          .filter(([, v]) => v)),
        fit_preferences: d.fits, height_cm: Number.isFinite(height) ? height : null,
        weight_kg: Number.isFinite(weight) ? weight : null, type_prefs: d.typePrefs, budget_ranges: d.budgets, stores: d.stores,
        wardrobe_style: men ? 'menswear' : d.gender === 'female' ? 'womenswear' : 'neutral', onboarded: true,
      });
      toast(s.onb.done);
      if (edit) router.back();
      else router.replace('/');
    } catch (e) {
      toast(errorMessage(e), 'error');
      setSaving(false);
    }
  };

  // Leave the first-time flow without finishing: the app opens normally and
  // Profile offers "Set up style profile" until the rest is filled in.
  const later = async () => {
    setAsk(null);
    try {
      await updateUser({ onboarded: true, ...(d.gender ? { gender: d.gender } : {}) });
      router.replace('/');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  // Love → avoid → cleared (MVP §1, step 3).
  const cycleColor = (c: string) => {
    if (d.love.includes(c)) set({ love: d.love.filter((x) => x !== c), avoid: [...d.avoid, c] });
    else if (d.avoid.includes(c)) set({ avoid: d.avoid.filter((x) => x !== c) });
    else set({ love: [...d.love, c] });
  };

  const one = (options: readonly string[], value: string | undefined, onPick: (v: string) => void, name: (v: string) => string = (v) => v) => (
    <ChipWrap>{options.map((o) => <Chip key={o} label={name(o)} selected={value === o} onPress={() => onPick(o)} />)}</ChipWrap>
  );
  const h = (text: string) => <Text style={[type.label, { color: t.textSub, marginTop: space.sm }]}>{text}</Text>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.top}>
        {step > 0 ? (
          <Pressable onPress={() => setStep(step - 1)} hitSlop={10} accessibilityRole="button">
            <Text style={[type.bodyStrong, { color: t.primary }]}>{s.onb.back}</Text>
          </Pressable>
        ) : edit ? (
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
            <Text style={[type.bodyStrong, { color: t.primary }]}>{s.common.cancel}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setAsk('exit')} hitSlop={10} accessibilityRole="button">
            <Text style={[type.bodyStrong, { color: t.textSub }]}>{s.onb.exit}</Text>
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Text style={[type.caption, { color: t.textMuted }]}>{s.onb.step(step + 1, steps.length)}</Text>
          {!edit ? (
            <Pressable onPress={() => setAsk('later')} hitSlop={10} accessibilityRole="button">
              <Text style={[type.bodyStrong, { color: t.primary }]}>{s.onb.later}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={[styles.meter, { backgroundColor: t.cardAlt }]}>
        <View style={{ width: `${((step + 1) / steps.length) * 100}%`, height: 4, backgroundColor: t.primary, borderRadius: 2 }} />
      </View>

      <FormScroll contentContainerStyle={styles.wrap}>
        <Text style={[type.display, { color: t.text }]}>{steps[step].title}</Text>
        <Text style={[type.body, { color: t.textSub }]}>{steps[step].sub}</Text>

        {step === 0 ? (
          <View style={{ gap: space.sm }}>
            {h(s.onb.age)}
            {one(AGES, d.age_range, (v) => set({ age_range: v as Draft['age_range'] }))}
            {h(s.onb.shoppingFor)}
            <Segmented options={['female', 'male', 'unsaid'] as const} value={d.gender} label={(v) => s.about.genders[v]}
              onChange={(v) => set({ gender: v, bottom: '', jacket: '', length: '', drop: '' })} />
            {men ? <Text style={[type.caption, { color: t.accent }]}>{s.onb.menSoon}</Text> : null}
            {h(s.onb.country)}
            {one(COUNTRIES, d.country, (v) => set({ country: v }), (v) => s.onb.countries[v])}
            {h(`${s.onb.bodyLabel} · ${s.onb.optional}`)}
            <View style={styles.pair}>
              <View style={{ flex: 1 }}>
                <Field value={d.height} onChangeText={(v) => set({ height: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" maxLength={3} placeholder="cm" />
              </View>
              <View style={{ flex: 1 }}>
                <Field value={d.weight} onChangeText={(v) => set({ weight: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" maxLength={3} placeholder="kg" />
              </View>
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <SwipeDeck items={swipeItems} answers={d.typePrefs}
            onAnswer={answerSwipe}
            onUndo={() => setD((x) => {
              const answered = swipeItems.filter((i) => i.sub in x.typePrefs);
              const last = answered[answered.length - 1];
              if (!last) return x;
              const next = { ...x.typePrefs };
              delete next[last.sub];
              return { ...x, typePrefs: next };
            })} />
        ) : null}

        {step === 3 ? (
          <View style={{ gap: space.sm }}>
            <Text style={[type.caption, { color: t.text, fontWeight: '600' }]}>{s.onb.selected(d.styles.length)}</Text>
            <View style={styles.styleGrid}>
              {stylesFor(d.gender, meta.style_directions, d.styles).map((st) => {
                const on = d.styles.includes(st);
                const photo = stylePhoto(st, d.gender);
                return (
                  <Pressable key={st} onPress={() => set({ styles: toggle(d.styles, st) })} accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }} accessibilityLabel={label('styles', st)}
                    style={[styles.styleCard, { backgroundColor: t.card, borderColor: on ? t.primary : t.border, borderWidth: on ? 2 : 1 }]}>
                    {photo ? (
                      <Image source={photo} style={styles.styleSwatch} contentFit="cover" transition={120} />
                    ) : (
                      <View style={[styles.styleSwatch, { backgroundColor: STYLE_COLOR[st] ?? t.cardAlt }]} />
                    )}
                    <Text style={[type.caption, { color: on ? t.primary : t.text, fontWeight: '600', textAlign: 'center' }]} numberOfLines={2}>
                      {label('styles', st)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.colorGrid}>
            {Object.entries(meta.colors).map(([c, rgb]) => {
              const state = d.love.includes(c) ? 'love' : d.avoid.includes(c) ? 'avoid' : '';
              return (
                <Pressable key={c} onPress={() => cycleColor(c)} accessibilityRole="button"
                  accessibilityLabel={`${label('colors', c)}${state ? `: ${state === 'love' ? s.onb.love : s.onb.avoid}` : ''}`}
                  style={[styles.colorCell, {
                    backgroundColor: t.card, borderColor: state === 'love' ? t.primary : state === 'avoid' ? t.danger : t.border,
                    borderWidth: state ? 2 : 1,
                  }]}>
                  <View style={[styles.colorDot, { backgroundColor: rgbCss(rgb), borderColor: t.border }]} />
                  <Text style={[type.caption, { color: t.text, flex: 1 }]} numberOfLines={1}>{label('colors', c)}</Text>
                  {state ? (
                    <Text style={[type.caption, { color: state === 'love' ? t.primary : t.danger, fontWeight: '700' }]}>
                      {state === 'love' ? s.onb.love : s.onb.avoid}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === 1 ? (
          <View style={{ gap: space.sm }}>
            {h(s.onb.tops)}
            {one(TOPS, d.top, (v) => set({ top: v }))}
            {h(men ? s.onb.bottomsWaist : s.onb.bottomsEu)}
            {one(men ? WAIST : EU, d.bottom, (v) => set({ bottom: v }))}
            {men ? (
              <>
                {h(`${s.onb.length} · ${s.onb.optional}`)}
                {one(LENGTHS, d.length, (v) => set({ length: d.length === v ? '' : v }))}
              </>
            ) : null}
            {h(`${s.onb.jacket} · ${s.onb.optional}`)}
            {one(men ? JACKETS_MEN : EU, d.jacket, (v) => set({ jacket: d.jacket === v ? '' : v }))}
            {men ? (
              <>
                {h(`${s.onb.drop} · ${s.onb.optional}`)}
                {one(DROPS, d.drop, (v) => set({ drop: d.drop === v ? '' : v }))}
              </>
            ) : null}
            {h(s.onb.shoes)}
            {one(SHOES, d.shoes, (v) => set({ shoes: v }))}
            {h(s.onb.fitMany)}
            <ChipWrap>
              {FITS.map((f) => <Chip key={f} label={label('fits', f)} selected={d.fits.includes(f)} onPress={() => set({ fits: toggle(d.fits, f) })} />)}
            </ChipWrap>
          </View>
        ) : null}

        {step === 5 ? (
          <View style={{ gap: space.sm }}>
            {h(s.onb.budgetPer)}
            <ChipWrap>
              {BUDGETS.map((b) => <Chip key={b} label={s.onb.budgets[b]} selected={d.budgets.includes(b)} onPress={() => set({ budgets: toggle(d.budgets, b) })} />)}
            </ChipWrap>
            <Text style={[type.caption, { color: t.textMuted }]}>{s.onb.budgetHint}</Text>
            {h(s.onb.stores)}
            <ChipWrap>
              {STORES.map((x) => <Chip key={x} label={x} selected={d.stores.includes(x)} onPress={() => set({ stores: toggle(d.stores, x) })} />)}
            </ChipWrap>
          </View>
        ) : null}
      </FormScroll>

      <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.card }]}>
        <Button title={last ? s.onb.finish : s.onb.next} onPress={() => (last ? finish() : setStep(step + 1))}
          disabled={!steps[step].ok} loading={saving} />
      </View>
      <ConfirmationDialog
        visible={ask !== null}
        title={ask === 'exit' ? s.onb.exitTitle : s.onb.laterTitle}
        message={ask === 'exit' ? s.onb.exitBody : s.onb.laterBody}
        confirmLabel={ask === 'exit' ? s.onb.exit : s.onb.later}
        cancelLabel={s.common.cancel}
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          if (ask === 'exit') { setAsk(null); signOut(); } else later();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter, paddingTop: space.md, minHeight: 36 },
  meter: { height: 4, borderRadius: 2, marginHorizontal: gutter, marginTop: space.sm },
  wrap: { paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.md, paddingBottom: space.xxl },
  pair: { flexDirection: 'row', gap: space.md },
  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  styleCard: { width: '31.5%', borderRadius: radius.md, padding: space.sm, gap: space.xs, alignItems: 'center' },
  styleSwatch: { width: '100%', aspectRatio: 1, borderRadius: radius.sm },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  colorCell: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
  footer: { paddingHorizontal: gutter, paddingTop: space.sm, paddingBottom: space.lg, borderTopWidth: 1 },
});
