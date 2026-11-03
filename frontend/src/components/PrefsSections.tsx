import { StyleSheet, Text, View } from 'react-native';
import { useI18n, useLabel } from '../lib/i18n';
import { useMeta } from '../lib/meta';
import { space, type, useTheme } from '../theme';
import type { User } from '../types';
import { ColorSelector, PreferenceSelector } from './Preferences';
import { Chip, ChipWrap, Field } from './ui';

export type Prefs = Required<Pick<User, 'preferred_styles' | 'favorite_colors' | 'typical_occasions' | 'sizes' | 'units'>> &
  Pick<User, 'wardrobe_style'>;

export function prefsFromUser(u: User | null): Prefs {
  return {
    preferred_styles: u?.preferred_styles?.length ? u.preferred_styles : u?.style_direction ? [u.style_direction] : [],
    favorite_colors: u?.favorite_colors ?? [],
    typical_occasions: u?.typical_occasions?.length ? u.typical_occasions : u?.main_occasion ? [u.main_occasion] : [],
    sizes: u?.sizes ?? {},
    units: u?.units ?? 'metric',
    wardrobe_style: u?.wardrobe_style ?? 'neutral',
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
        <ColorSelector value={prefs.favorite_colors} onChange={(v) => onChange({ ...prefs, favorite_colors: v })} />
      </View>
    </>
  );
}

export function SizesSection({ prefs, onChange }: { prefs: Prefs; onChange: (p: Prefs) => void }) {
  const { t: s } = useI18n();
  const setSize = (k: 'top' | 'bottom' | 'shoes', v: string) => onChange({ ...prefs, sizes: { ...prefs.sizes, [k]: v.slice(0, 12) } });
  return (
    <>
      <View style={styles.section}>
        <Heading title={s.prefs.sizesTitle} body={s.prefs.sizesBody} />
        <View style={styles.sizes}>
          <View style={{ flex: 1 }}><Field label={s.prefs.sizeTop} value={prefs.sizes.top ?? ''} onChangeText={(v) => setSize('top', v)} placeholder="M" /></View>
          <View style={{ flex: 1 }}><Field label={s.prefs.sizeBottom} value={prefs.sizes.bottom ?? ''} onChangeText={(v) => setSize('bottom', v)} placeholder="32" /></View>
          <View style={{ flex: 1 }}><Field label={s.prefs.sizeShoes} value={prefs.sizes.shoes ?? ''} onChangeText={(v) => setSize('shoes', v)} placeholder="42" /></View>
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
});
