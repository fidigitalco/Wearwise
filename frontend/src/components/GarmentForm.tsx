import { Switch, View } from 'react-native';
import type { GarmentInput } from '../lib/api';
import { CATEGORY_ORDER, FORMALITY_LABELS, WARMTH_LABELS, humanize, rgbCss, useMeta } from '../lib/meta';
import { space, useTheme } from '../lib/theme';
import type { Category, GarmentColor } from '../lib/types';
import { Body, Chip, ChipRow, ChipWrap, Field, Label, Stepper } from './ui';

export type GarmentDraft = Required<
  Pick<GarmentInput, 'name' | 'category' | 'subcategory' | 'pattern' | 'fit' | 'formality' | 'warmth' | 'rain_ok' | 'season' | 'colors'>
> & { materialValue: string };

/** What a typical piece of each kind is like, so most users never touch the steppers. */
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
    formality: 2, warmth: 1, rain_ok: false, season: [], colors: [], materialValue: '',
  };
}

export function draftToInput(d: GarmentDraft): GarmentInput {
  const { materialValue, ...rest } = d;
  return {
    ...rest,
    material: materialValue.trim() ? { value: materialValue.trim().toLowerCase(), source: 'user', confidence: 1 } : {},
  };
}

export function GarmentForm({
  draft, onChange, colorsHint,
}: { draft: GarmentDraft; onChange: (d: GarmentDraft) => void; colorsHint?: string }) {
  const t = useTheme();
  const meta = useMeta();
  const set = (patch: Partial<GarmentDraft>) => onChange({ ...draft, ...patch });

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

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <Label>Type</Label>
        <ChipRow>
          {CATEGORY_ORDER.map((c) => (
            <Chip key={c} label={humanize(c)} selected={draft.category === c} onPress={() => pickCategory(c)} />
          ))}
        </ChipRow>
        <ChipWrap>
          {(meta.categories[draft.category as Category] ?? []).map((s) => (
            <Chip key={s} label={humanize(s)} selected={draft.subcategory === s} onPress={() => pickSub(s)} />
          ))}
        </ChipWrap>
      </View>

      <Field label="Name" value={draft.name} onChangeText={(name) => set({ name })} placeholder="e.g. Yellow rain jacket (optional)" />

      <View style={{ gap: space.sm }}>
        <Label>Colours</Label>
        {colorsHint ? <Body muted>{colorsHint}</Body> : null}
        <ChipWrap>
          {Object.entries(meta.colors).map(([name, rgb]) => (
            <Chip
              key={name}
              label={humanize(name)}
              swatch={rgbCss(rgb)}
              selected={draft.colors.some((c) => c.name === name)}
              onPress={() => toggleColor(name)}
            />
          ))}
        </ChipWrap>
      </View>

      <View style={{ gap: space.sm }}>
        <Label>Pattern</Label>
        <ChipWrap>
          {meta.patterns.map((p) => (
            <Chip key={p} label={humanize(p)} selected={draft.pattern === p} onPress={() => set({ pattern: p })} />
          ))}
        </ChipWrap>
      </View>

      <View style={{ gap: space.sm }}>
        <Label>Fit</Label>
        <ChipRow>
          {meta.fits.map((f) => (
            <Chip key={f} label={humanize(f)} selected={draft.fit === f} onPress={() => set({ fit: f })} />
          ))}
        </ChipRow>
      </View>

      <View style={{ gap: space.sm }}>
        <Label>Formality</Label>
        <Stepper value={draft.formality} min={1} max={5} onChange={(formality) => set({ formality })} labels={FORMALITY_LABELS} />
      </View>

      <View style={{ gap: space.sm }}>
        <Label>Warmth</Label>
        <Stepper value={draft.warmth} min={0} max={5} onChange={(warmth) => set({ warmth })} labels={WARMTH_LABELS} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Label>Rain-proof</Label>
          <Body muted>Suggested first on wet days.</Body>
        </View>
        <Switch
          value={draft.rain_ok}
          onValueChange={(rain_ok) => set({ rain_ok })}
          trackColor={{ true: t.highlight, false: t.cardAlt }}
          accessibilityLabel="Rain-proof"
        />
      </View>

      <View style={{ gap: space.sm }}>
        <Label>Seasons</Label>
        <Body muted>Leave empty if you wear it all year.</Body>
        <ChipRow>
          {meta.seasons.map((s) => (
            <Chip key={s} label={humanize(s)} selected={draft.season.includes(s)} onPress={() => toggleSeason(s)} />
          ))}
        </ChipRow>
      </View>

      <Field
        label="Material (from the care label)"
        value={draft.materialValue}
        onChangeText={(materialValue) => set({ materialValue })}
        placeholder="e.g. merino, cotton, nylon"
        autoCapitalize="none"
      />
    </View>
  );
}
