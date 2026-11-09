import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n, useLabel } from '../lib/i18n';
import { rgbCss, useMeta } from '../lib/meta';
import { radius, space, type, useTheme } from '../theme';
import { BottomSheet } from './Overlays';

/**
 * Colours in one line, the full palette in a sheet: the picked swatches and
 * their names, "Change" to open the grid. With `single`, a tap picks the one
 * colour and closes the sheet; otherwise taps toggle, and the number on a
 * swatch is its order (the first is the main colour).
 */
export function ColorPicker({ value, onToggle, single, hint }: {
  value: { name: string; rgb?: [number, number, number] }[];
  onToggle: (name: string) => void;
  single?: boolean;
  hint?: string;
}) {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const meta = useMeta();
  const [open, setOpen] = useState(false);
  const names = value.map((c) => label('colors', c.name)).join(', ');

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${s.form.colors}: ${names || s.form.pickColor}`}
        style={({ pressed }) => [styles.row, { borderColor: t.border, backgroundColor: pressed ? t.cardAlt : t.card }]}
      >
        {value.length ? (
          <>
            <View style={styles.dots}>
              {value.slice(0, 4).map((c) => (
                <View key={c.name} style={[styles.dot, { backgroundColor: rgbCss(c.rgb ?? meta.colors[c.name]), borderColor: t.border }]} />
              ))}
            </View>
            <Text style={[type.body, { color: t.text, flex: 1 }]} numberOfLines={1}>{names}</Text>
          </>
        ) : (
          <>
            <View style={[styles.dot, styles.emptyDot, { borderColor: t.textMuted }]} />
            <Text style={[type.body, { color: t.textMuted, flex: 1 }]}>{s.form.pickColor}</Text>
          </>
        )}
        <Text style={{ color: t.highlight, fontWeight: '600' }}>{s.common.change}</Text>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={s.form.colors} closeLabel={s.common.done}>
        {hint ? <Text style={[type.caption, { color: t.textMuted }]}>{hint}</Text> : null}
        <View style={styles.grid}>
          {Object.entries(meta.colors).map(([name, rgb]) => {
            const idx = value.findIndex((c) => c.name === name);
            const on = idx >= 0;
            const light = name === 'white' || name === 'cream' || name === 'beige';
            return (
              <Pressable
                key={name}
                onPress={() => {
                  onToggle(name);
                  if (single) setOpen(false);
                }}
                accessibilityRole={single ? 'radio' : 'checkbox'}
                accessibilityState={{ checked: on }}
                accessibilityLabel={label('colors', name)}
                style={styles.cell}
              >
                <View style={[styles.swatch, { backgroundColor: rgbCss(rgb), borderColor: on ? t.primary : t.border, borderWidth: on ? 3 : 1 }]}>
                  {on && !single ? <Text style={{ color: light ? t.text : '#fff', fontWeight: '700', fontSize: 12 }}>{idx + 1}</Text> : null}
                </View>
                <Text style={[styles.name, { color: on ? t.text : t.textMuted }]} numberOfLines={1}>{label('colors', name)}</Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1 },
  dots: { flexDirection: 'row' },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, marginRight: -6 },
  emptyDot: { borderStyle: 'dashed', marginRight: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  cell: { width: '16.66%', alignItems: 'center', gap: 4 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 10, maxWidth: 52, textAlign: 'center' },
});
