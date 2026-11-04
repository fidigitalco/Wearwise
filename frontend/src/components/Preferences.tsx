import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useI18n, useLabel } from '../lib/i18n';
import { rgbCss, useMeta } from '../lib/meta';
import { radius, space, type, useTheme } from '../theme';

const STYLE_PHOTOS: Record<string, number> = {
  casual: require('../../assets/images/style-casual.jpg'),
  smart_casual: require('../../assets/images/style-smart_casual.jpg'),
  business: require('../../assets/images/style-business.jpg'),
  minimal: require('../../assets/images/style-minimal.jpg'),
  streetwear: require('../../assets/images/style-streetwear.jpg'),
  classic: require('../../assets/images/style-classic.jpg'),
  sporty: require('../../assets/images/style-sporty.jpg'),
  bohemian: require('../../assets/images/style-bohemian.jpg'),
  formal: require('../../assets/images/style-formal.jpg'),
};

// Styles without a photo yet show their palette instead.
const STYLE_PALETTES: Record<string, string[]> = {
  old_money: ['navy', 'cream', 'camel', 'brown'],
  preppy: ['navy', 'white', 'red', 'khaki'],
  romantic: ['pink', 'cream', 'burgundy', 'light_blue'],
};

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** Style choices as photo cards, several at once; the first picked leads. */
export function PreferenceSelector({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const meta = useMeta();
  const { width } = useWindowDimensions();
  const w = (width - space.lg * 2 - space.md) / 2;
  return (
    <View style={styles.grid}>
      {meta.style_directions.map((st) => {
        const on = value.includes(st);
        return (
          <Pressable
            key={st}
            onPress={() => onChange(toggle(value, st))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={label('styles', st)}
            style={[styles.card, { width: w, borderColor: on ? t.primary : t.border, backgroundColor: t.card }]}
          >
            <View>
              {STYLE_PHOTOS[st] ? (
                <Image source={STYLE_PHOTOS[st]} style={styles.photo} contentFit="cover" transition={120} />
              ) : STYLE_PALETTES[st] ? (
                <View style={[styles.photo, styles.palette]}>
                  {STYLE_PALETTES[st].map((c) => <View key={c} style={{ flex: 1, backgroundColor: rgbCss(meta.colors[c]) }} />)}
                </View>
              ) : (
                <View style={[styles.photo, { backgroundColor: t.cardAlt }]} />
              )}
              {on ? (
                <View style={[styles.check, { backgroundColor: t.primary }]}>
                  <Check size={14} color={t.onPrimary} strokeWidth={3} />
                </View>
              ) : null}
            </View>
            <View style={{ padding: space.sm, gap: 2 }}>
              <Text style={[type.bodyStrong, { color: on ? t.primary : t.text }]}>{label('styles', st)}</Text>
              <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={2}>{s.tx.styleExamples[st]}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ColorSelector({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useTheme();
  const label = useLabel();
  const meta = useMeta();
  return (
    <View style={styles.swatches}>
      {Object.entries(meta.colors).map(([name, rgb]) => {
        const on = value.includes(name);
        return (
          <Pressable
            key={name}
            onPress={() => onChange(toggle(value, name))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={label('colors', name)}
            style={styles.swatchItem}
          >
            <View style={[styles.swatch, { backgroundColor: rgbCss(rgb), borderColor: on ? t.primary : t.border, borderWidth: on ? 3 : StyleSheet.hairlineWidth }]}>
              {on ? <Check size={16} color={name === 'white' || name === 'cream' || name === 'beige' ? t.text : t.onImage} strokeWidth={3} /> : null}
            </View>
            <Text style={[type.caption, { color: on ? t.primary : t.textMuted }]} numberOfLines={1}>{label('colors', name)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  palette: { flexDirection: 'row', overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { borderRadius: radius.lg, borderWidth: 2, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 1.1 },
  check: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatchItem: { width: 62, alignItems: 'center', gap: 4 },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
