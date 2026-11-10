import { StyleSheet, Text, View } from 'react-native';
import { ColorPicker } from './ColorPicker';
import { useI18n, useLabel } from '../lib/i18n';
import { useMeta } from '../lib/meta';
import { space, type, useTheme } from '../theme';
import type { User } from '../types';
import { PreferenceSelector } from './Preferences';
import { Chip, ChipWrap, Field, Segmented } from './ui';

export type Prefs = Required<Pick<User, 'preferred_styles' | 'favorite_colors' | 'typical_occasions' | 'sizes' | 'units' | 'avoid_colors'>> &
  Pick<User, 'wardrobe_style' | 'gender' | 'birth_year' | 'height_cm' | 'weight_kg' | 'body_shape' | 'budget'> & { fit_preferences: string[] };

const LETTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export function prefsFromUser(u: User | null): Prefs {
  return {
    preferred_styles: u?.preferred_styles?.length ? u.preferred_styles : u?.style_direction ? [u.style_direction] : [],
    favorite_colors: u?.favorite_colors ?? [],
    typical_occasions: u?.typical_occasions?.length ? u.typical_occasions : u?.main_occasion ? [u.main_occasion] : [],
    sizes: u?.sizes ?? {},
    units: u?.units ?? 'metric',
    wardrobe_style: u?.wardrobe_style ?? 'neutral',
    gender: u?.gender ?? '',
    birth_year: u?.birth_year ?? null,
    height_cm: u?.height_cm ?? null,
    weight_kg: u?.weight_kg ?? null,
    body_shape: u?.body_shape ?? '',
    fit_preferences: u?.fit_preferences?.length ? u.fit_preferences : u?.fit_preference ? [u.fit_preference] : [],
    budget: u?.budget ?? '',
    avoid_colors: u?.avoid_colors ?? [],
  };
}

/** What to send to PATCH /auth/me/; the first typical occasion becomes the one Home opens on. */
export function prefsToPatch(p: Prefs): Partial<User> {
  return { ...p, ...(p.typical_occasions[0] ? { main_occasion: p.typical_occasions[0] } : {}) };
}

function Heading({ title, body }: { title: string; body?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[type.title, { color: t.text }]}>{title}</Text>
      {body ? <Text style={[type.body, { color: t.textMuted }]}>{body}</Text> : null}
    </View>
  );
}

/** A whole number from a text field, or null when it is empty. */
function toNumber(v: string): number | null {
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** Pick one, or tap the picked one again to clear it (every About-you answer is optional). */
function OneOf<T extends string>({ options, value, label, onChange }: {
  options: readonly T[]; value: T | '' | undefined; label: (v: T) => string; onChange: (v: T | '') => void;
}) {
  return (
    <ChipWrap>
      {options.map((o) => <Chip key={o} label={label(o)} selected={value === o} onPress={() => onChange(value === o ? '' : o)} />)}
    </ChipWrap>
  );
}

/** About you: what a stylist asks before dressing someone (prototype spec §2.3, KB §1 personalisation). */
export function AboutYouSection({ prefs, onChange }: { prefs: Prefs; onChange: (p: Prefs) => void }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const set = (patch: Partial<Prefs>) => onChange({ ...prefs, ...patch });
  const age = prefs.birth_year && prefs.birth_year > 1900 ? new Date().getFullYear() - prefs.birth_year : null;
  const toggleAvoid = (c: string) =>
    set({
      avoid_colors: prefs.avoid_colors.includes(c) ? prefs.avoid_colors.filter((x) => x !== c) : [...prefs.avoid_colors, c],
      favorite_colors: prefs.favorite_colors.filter((x) => x !== c),
    });
  return (
    <View style={styles.section}>
      <Heading title={s.about.title} body={s.about.body} />
      <View style={styles.field}>
        <Text style={[type.label, { color: t.textSub }]}>{s.about.gender}</Text>
        <Segmented options={['female', 'male', 'unsaid'] as const} value={prefs.gender} label={(g) => s.about.genders[g]} onChange={(gender) => set({ gender })} />
      </View>
      <View style={styles.sizes}>
        <View style={{ flex: 1, gap: 4 }}>
          <Field label={s.about.birthYear} value={prefs.birth_year ? String(prefs.birth_year) : ''} keyboardType="number-pad" maxLength={4}
            onChangeText={(v) => set({ birth_year: toNumber(v) })} placeholder="1995" />
          {age && age > 0 && age < 120 ? <Text style={[type.caption, { color: t.textMuted }]}>{s.about.age(age)}</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Field label={s.about.heightCm} value={prefs.height_cm ? String(prefs.height_cm) : ''} keyboardType="number-pad" maxLength={3}
            onChangeText={(v) => set({ height_cm: toNumber(v) })} placeholder="170" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={s.about.weightKg} value={prefs.weight_kg ? String(prefs.weight_kg) : ''} keyboardType="number-pad" maxLength={3}
            onChangeText={(v) => set({ weight_kg: toNumber(v) })} placeholder="65" />
        </View>
      </View>
      <View style={styles.field}>
        <Text style={[type.label, { color: t.textSub }]}>{s.about.bodyShape}</Text>
        <Text style={[type.caption, { color: t.textMuted }]}>{s.about.bodyShapeBody}</Text>
        <OneOf options={['rectangle', 'triangle', 'inverted_triangle', 'hourglass', 'oval'] as const} value={prefs.body_shape}
          label={(b) => s.about.bodyShapes[b]} onChange={(body_shape) => set({ body_shape })} />
      </View>
      <View style={styles.field}>
        <Text style={[type.label, { color: t.textSub }]}>{s.onb.fitMany}</Text>
        <ChipWrap>
          {(['slim', 'regular', 'relaxed', 'oversized'] as const).map((f) => (
            <Chip key={f} label={label('fits', f)} selected={prefs.fit_preferences.includes(f)}
              onPress={() => set({ fit_preferences: prefs.fit_preferences.includes(f) ? prefs.fit_preferences.filter((x) => x !== f) : [...prefs.fit_preferences, f] })} />
          ))}
        </ChipWrap>
      </View>
      <View style={styles.field}>
        <Text style={[type.label, { color: t.textSub }]}>{s.about.budget}</Text>
        <OneOf options={['low', 'mid', 'high'] as const} value={prefs.budget} label={(b) => s.about.budgets[b]} onChange={(budget) => set({ budget })} />
      </View>
      <View style={styles.field}>
        <Text style={[type.label, { color: t.textSub }]}>{s.about.avoid}</Text>
        <Text style={[type.caption, { color: t.textMuted }]}>{s.about.avoidBody}</Text>
        <ColorPicker value={prefs.avoid_colors.map((name) => ({ name }))} onToggle={toggleAvoid} />
      </View>
    </View>
  );
}

export function StylesSection({ prefs, onChange }: { prefs: Prefs; onChange: (p: Prefs) => void }) {
  const { t: s } = useI18n();
  return (
    <View style={styles.section}>
      <Heading title={s.prefs.stylesTitle} body={s.prefs.stylesBody} />
      <PreferenceSelector value={prefs.preferred_styles} onChange={(v) => onChange({ ...prefs, preferred_styles: v })} />
    </View>
  );
}

export function AboutSection({ prefs, onChange }: { prefs: Prefs; onChange: (p: Prefs) => void }) {
  const { t: s } = useI18n();
  const label = useLabel();
  const meta = useMeta();
  const toggle = (v: string) =>
    onChange({
      ...prefs,
      typical_occasions: prefs.typical_occasions.includes(v) ? prefs.typical_occasions.filter((x) => x !== v) : [...prefs.typical_occasions, v],
    });
  return (
    <>
      <View style={styles.section}>
        <Heading title={s.settings.wardrobe} body={s.settings.wardrobeHint} />
        <ChipWrap>
          {(['womenswear', 'menswear', 'neutral'] as const).map((w) => (
            <Chip key={w} label={label('wardrobes', w)} selected={prefs.wardrobe_style === w} onPress={() => onChange({ ...prefs, wardrobe_style: w })} />
          ))}
        </ChipWrap>
      </View>
      <View style={styles.section}>
        <Heading title={s.prefs.occasionsTitle} body={s.prefs.occasionsBody} />
        <ChipWrap>
          {Object.keys(meta.occasions).map((o) => (
            <Chip key={o} label={label('occasions', o)} selected={prefs.typical_occasions.includes(o)} onPress={() => toggle(o)} />
          ))}
        </ChipWrap>
      </View>
      <View style={styles.section}>
        <Heading title={s.prefs.colorsTitle} body={s.prefs.colorsBody} />
        <ColorPicker
          value={prefs.favorite_colors.map((name) => ({ name }))}
          onToggle={(c) => onChange({
            ...prefs,
            favorite_colors: prefs.favorite_colors.includes(c) ? prefs.favorite_colors.filter((x) => x !== c) : [...prefs.favorite_colors, c],
            // A colour you love is no longer one you avoid.
            avoid_colors: prefs.avoid_colors.filter((x) => x !== c),
          })}
        />
      </View>
    </>
  );
}

export function SizesSection({ prefs, onChange }: { prefs: Prefs; onChange: (p: Prefs) => void }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const setSize = (k: 'top' | 'bottom' | 'length' | 'shoes' | 'jacket' | 'drop', v: string) => onChange({ ...prefs, sizes: { ...prefs.sizes, [k]: v.slice(0, 12) } });
  return (
    <>
      <View style={styles.section}>
        <Heading title={s.prefs.sizesTitle} body={s.prefs.sizesBody} />
        <View style={styles.field}>
          <Text style={[type.label, { color: t.textSub }]}>{s.prefs.sizeTop}</Text>
          <OneOf options={LETTER_SIZES} value={prefs.sizes.top} label={(x) => x} onChange={(v) => setSize('top', v)} />
        </View>
        <View style={styles.field}>
          <Text style={[type.label, { color: t.textSub }]}>{s.prefs.sizeBottom}</Text>
          <OneOf options={LETTER_SIZES} value={prefs.sizes.bottom} label={(x) => x} onChange={(v) => setSize('bottom', v)} />
        </View>
        <View style={styles.sizes}>
          <View style={{ flex: 1 }}>
            <Field label={s.prefs.sizeShoes} value={prefs.sizes.shoes ?? ''} keyboardType="decimal-pad" maxLength={5}
              onChangeText={(v) => setSize('shoes', v)} placeholder="42" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={s.onb.length} value={prefs.sizes.length ?? ''} keyboardType="number-pad" maxLength={2}
              onChangeText={(v) => setSize('length', v)} placeholder="30" />
          </View>
        </View>
        <View style={styles.sizes}>
          <View style={{ flex: 1 }}>
            <Field label={s.onb.jacket} value={prefs.sizes.jacket ?? ''} keyboardType="number-pad" maxLength={3}
              onChangeText={(v) => setSize('jacket', v)} placeholder="50" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={s.onb.drop} value={prefs.sizes.drop ?? ''} keyboardType="number-pad" maxLength={2}
              onChangeText={(v) => setSize('drop', v)} placeholder="4" />
          </View>
        </View>
      </View>
      <View style={styles.section}>
        <Heading title={s.prefs.unitsTitle} />
        <ChipWrap>
          {(['metric', 'imperial'] as const).map((u) => (
            <Chip key={u} label={u === 'metric' ? s.prefs.metric : s.prefs.imperial} selected={prefs.units === u} onPress={() => onChange({ ...prefs, units: u })} />
          ))}
        </ChipWrap>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  sizes: { flexDirection: 'row', gap: space.md },
  field: { gap: space.sm },
});
