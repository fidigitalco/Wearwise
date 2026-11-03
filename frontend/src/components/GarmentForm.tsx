import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { GarmentInput } from '../services/api';
import { useAuth } from '../lib/auth';
import { useI18n, useLabel } from '../lib/i18n';
import { categoriesFor, rgbCss, subcategoriesFor, useMeta } from '../lib/meta';
import { radius, space, useTheme } from '../theme';
import type { Category, Garment, GarmentColor, Material } from '../types';
import { Body, Chip, ChipRow, ChipWrap, Field, Label, Stepper } from './ui';

export type GarmentDraft = Required<
  Pick<GarmentInput, 'name' | 'category' | 'subcategory' | 'pattern' | 'fit' | 'formality' | 'warmth' | 'rain_ok' | 'season' | 'colors' | 'occasion_tags'>
> & { materialValue: string; materialOriginal: Material };

/** Below this the AI's guess is flagged "Check this" (KB section 4, stage 5). */
const CHECK_BELOW = 0.75;

/** What a typical piece of each kind is like, for pieces added by hand. */
const PRESETS: Record<string, Partial<GarmentDraft>> = {
  t_shirt: { warmth: 1, formality: 1 }, tank_top: { warmth: 0, formality: 1 }, polo: { warmth: 1, formality: 2 },
  shirt: { warmth: 1, formality: 3 }, blouse: { warmth: 1, formality: 3 }, sweater: { warmth: 3, formality: 3 },
  hoodie: { warmth: 2, formality: 1 }, cardigan: { warmth: 2, formality: 3 },
  jeans: { warmth: 2, formality: 2 }, trousers: { warmth: 2, formality: 4 }, chinos: { warmth: 2, formality: 3 },
  shorts: { warmth: 0, formality: 1 }, skirt: { warmth: 1, formality: 3 }, joggers: { warmth: 2, formality: 1 },
  leggings: { warmth: 1, formality: 1 },
  day_dress: { warmth: 1, formality: 3 }, evening_dress: { warmth: 1, formality: 5 }, jumpsuit: { warmth: 2, formality: 3 },
  blazer: { warmth: 2, formality: 4 }, jacket: { warmth: 2, formality: 2 }, rain_jacket: { warmth: 2, formality: 2, rain_ok: true },
  coat: { warmth: 4, formality: 4 }, puffer: { warmth: 5, formality: 1 }, trench: { warmth: 3, formality: 4, rain_ok: true },
  denim_jacket: { warmth: 2, formality: 2 },
  sneakers: { warmth: 0, formality: 1 }, loafers: { warmth: 0, formality: 3 }, boots: { warmth: 1, formality: 3, rain_ok: true },
  heels: { warmth: 0, formality: 4 }, sandals: { warmth: 0, formality: 1 }, oxfords: { warmth: 0, formality: 5 },
  flats: { warmth: 0, formality: 3 },
  tie: { formality: 5 }, briefcase: { formality: 4 }, clutch: { formality: 4 }, backpack: { formality: 1 },
};

export function emptyDraft(): GarmentDraft {
  return {
    name: '', category: 'top', subcategory: '', pattern: 'solid', fit: 'regular',
    formality: 2, warmth: 1, rain_ok: false, season: [], colors: [], occasion_tags: [], materialValue: '', materialOriginal: {},
  };
}

export function draftFromGarment(g: Garment): GarmentDraft {
  return {
    name: g.name, category: g.category, subcategory: g.subcategory, pattern: g.pattern, fit: g.fit,
    formality: g.formality, warmth: g.warmth, rain_ok: g.rain_ok, season: g.season, colors: g.colors, occasion_tags: g.occasion_tags,
    materialValue: g.material?.value ?? '', materialOriginal: g.material ?? {},
  };
}

export function draftToInput(d: GarmentDraft): GarmentInput {
  const { materialValue, materialOriginal, ...rest } = d;
  const value = materialValue.trim().toLowerCase();
  // An unchanged AI estimate stays an estimate; only a value the user typed counts as theirs.
  const material: Material = !value
    ? {}
    : value === materialOriginal.value
      ? materialOriginal
      : { value, source: 'user', confidence: 1 };
  return { ...rest, material };
}

export function GarmentForm({
  draft, onChange, confidence, colorsHint,
}: {
  draft: GarmentDraft;
  onChange: (d: GarmentDraft) => void;
  /** Per-attribute confidence from the AI tagger; fields under 0.75 are flagged. */
  confidence?: Record<string, number>;
  colorsHint?: string;
}) {
  const t = useTheme();
  const meta = useMeta();
  const { user } = useAuth();
  const { t: s } = useI18n();
  const label = useLabel();
  const [editColors, setEditColors] = useState(draft.colors.length === 0);
  const [more, setMore] = useState(false);
  const set = (patch: Partial<GarmentDraft>) => onChange({ ...draft, ...patch });
  const unsure = (k: string) => confidence?.[k] !== undefined && confidence[k] < CHECK_BELOW;
  // Filled in by the AI tagger (confidently); the label stays until the user saves their own value.
  const ai = (k: string) => confidence?.[k] !== undefined && !unsure(k);

  const pickCategory = (c: Category) => set({ category: c, subcategory: '' });
  const pickSub = (s: string) => set({ subcategory: s, ...(PRESETS[s] ?? {}) });

  const toggleColor = (name: string) => {
    const has = draft.colors.some((c) => c.name === name);
    let next: GarmentColor[] = has
      ? draft.colors.filter((c) => c.name !== name)
      : [...draft.colors, { name, rgb: meta.colors[name], share: 0 }];
    // Manual picks share equally, first picked is primary.
    next = next.map((c) => ({ ...c, share: Math.round((1 / next.length) * 100) / 100 }));
    set({ colors: next });
  };

  const toggleSeason = (s: string) =>
    set({ season: draft.season.includes(s) ? draft.season.filter((x) => x !== s) : [...draft.season, s] });

  const moreNeedsCheck = unsure('pattern') || unsure('material');

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <Heading label={s.form.type} check={unsure('category')} ai={ai('category')} />
        <ChipRow>
          {categoriesFor(user?.wardrobe_style).map((c) => (
            <Chip key={c} label={label('categories', c)} selected={draft.category === c} onPress={() => pickCategory(c)} />
          ))}
        </ChipRow>
        <ChipWrap>
          {subcategoriesFor(meta, draft.category as Category, user?.wardrobe_style).map((sub) => (
            <Chip key={sub} label={label('subcategories', sub)} selected={draft.subcategory === sub} onPress={() => pickSub(sub)} />
          ))}
        </ChipWrap>
      </View>

      <Field label={s.form.name} value={draft.name} onChangeText={(name) => set({ name })} placeholder={s.form.namePlaceholder} />

      <View style={{ gap: space.sm }}>
        <View style={styles.rowBetween}>
          <Heading label={s.form.colors} check={unsure('color')} ai={ai('color')} />
          {draft.colors.length > 0 ? (
            <Pressable onPress={() => setEditColors((e) => !e)} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: t.highlight, fontWeight: '600' }}>{editColors ? s.common.done : s.common.change}</Text>
            </Pressable>
          ) : null}
        </View>
        {colorsHint ? <Body muted>{colorsHint}</Body> : null}
        {editColors ? (
          <ChipWrap>
            {Object.entries(meta.colors).map(([name, rgb]) => (
              <Chip
                key={name}
                label={label('colors', name)}
                swatch={rgbCss(rgb)}
                selected={draft.colors.some((c) => c.name === name)}
                onPress={() => toggleColor(name)}
              />
            ))}
          </ChipWrap>
        ) : (
          <ChipWrap>
            {draft.colors.map((c) => (
              <Chip key={c.name} label={label('colors', c.name)} swatch={rgbCss(c.rgb ?? meta.colors[c.name])} />
            ))}
          </ChipWrap>
        )}
      </View>

      <Pressable
        onPress={() => setMore((m) => !m)}
        accessibilityRole="button"
        accessibilityState={{ expanded: more }}
        style={[styles.moreToggle, { borderColor: t.border }]}
      >
        <Text style={{ color: t.text, fontWeight: '600', fontSize: 15 }}>{s.form.moreDetails}</Text>
        {moreNeedsCheck && !more ? <CheckBadge /> : null}
        <View style={{ flex: 1 }} />
        {more ? <ChevronUp size={18} color={t.textMuted} /> : <ChevronDown size={18} color={t.textMuted} />}
      </Pressable>

      {more ? (
        <View style={{ gap: space.xl }}>
          <View style={{ gap: space.sm }}>
            <Heading label={s.form.pattern} check={unsure('pattern')} ai={ai('pattern')} />
            <Body muted>{s.form.patternHint}</Body>
            <ChipWrap>
              {meta.patterns.map((p) => (
                <Chip key={p} label={label('patterns', p)} selected={draft.pattern === p} onPress={() => set({ pattern: p })} />
              ))}
            </ChipWrap>
          </View>

          <View style={{ gap: space.sm }}>
            <Label>{s.form.fit}</Label>
            <ChipRow>
              {meta.fits.map((f) => (
                <Chip key={f} label={label('fits', f)} selected={draft.fit === f} onPress={() => set({ fit: f })} />
              ))}
            </ChipRow>
          </View>

          <View style={{ gap: space.sm }}>
            <Label>{s.form.formality}</Label>
            <Stepper value={draft.formality} min={1} max={5} onChange={(formality) => set({ formality })} labels={s.form.formalityLevels} />
          </View>

          <View style={{ gap: space.sm }}>
            <Label>{s.form.warmth}</Label>
            <Stepper value={draft.warmth} min={0} max={5} onChange={(warmth) => set({ warmth })} labels={s.form.warmthLevels} />
          </View>

          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Label>{s.form.rainProof}</Label>
              <Body muted>{s.form.rainProofHint}</Body>
            </View>
            <Switch
              value={draft.rain_ok}
              onValueChange={(rain_ok) => set({ rain_ok })}
              trackColor={{ true: t.highlight, false: t.cardAlt }}
              accessibilityLabel={s.form.rainProof}
            />
          </View>

          <View style={{ gap: space.sm }}>
            <Label>{s.form.seasons}</Label>
            <Body muted>{s.form.seasonsHint}</Body>
            <ChipRow>
              {meta.seasons.map((x) => (
                <Chip key={x} label={label('seasons', x)} selected={draft.season.includes(x)} onPress={() => toggleSeason(x)} />
              ))}
            </ChipRow>
          </View>

          <View style={{ gap: space.sm }}>
            <Label>{s.form.occasions}</Label>
            <ChipWrap>
              {Object.keys(meta.occasions).map((o) => (
                <Chip key={o} label={label('occasions', o)} selected={draft.occasion_tags.includes(o)}
                  onPress={() => set({ occasion_tags: draft.occasion_tags.includes(o) ? draft.occasion_tags.filter((x) => x !== o) : [...draft.occasion_tags, o] })} />
              ))}
            </ChipWrap>
          </View>

          <View style={{ gap: space.xs }}>
            <Heading label={s.form.material} check={unsure('material')} ai={ai('material')} />
            {draft.materialOriginal.source === 'visual_estimate' && draft.materialValue === draft.materialOriginal.value ? (
              <Body muted>{s.form.materialGuessed}</Body>
            ) : null}
            <Field
              value={draft.materialValue}
              onChangeText={(materialValue) => set({ materialValue })}
              placeholder={s.form.materialPlaceholder}
              autoCapitalize="none"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Heading({ label, check, ai }: { label: string; check?: boolean; ai?: boolean }) {
  return (
    <View style={styles.row}>
      <Label>{label}</Label>
      {check ? <CheckBadge /> : ai ? <AiBadge /> : null}
    </View>
  );
}

function AiBadge() {
  const t = useTheme();
  const { t: s } = useI18n();
  return (
    <View style={[styles.badge, styles.row, { backgroundColor: t.cardAlt, gap: 4 }]}>
      <Sparkles size={11} color={t.textMuted} />
      <Text style={{ color: t.textMuted, fontSize: 11, fontWeight: '600' }}>{s.common.aiSuggestion}</Text>
    </View>
  );
}

function CheckBadge() {
  const t = useTheme();
  const { t: s } = useI18n();
  return (
    <View style={[styles.badge, { backgroundColor: t.highlightBg }]}>
      <Text style={{ color: t.highlight, fontSize: 11, fontWeight: '700' }}>{s.common.checkThis}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreToggle: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
});
