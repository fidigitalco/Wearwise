import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n, useLabel } from '../lib/i18n';
import { rgbCss, useMeta } from '../lib/meta';
import { STYLE_COLOR, STYLE_PHOTOS } from '../lib/styles';
import { space, type, useTheme } from '../theme';


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
            style={[styles.card, { borderColor: on ? t.primary : t.border, backgroundColor: t.card }]}
          >
            <View>
              {STYLE_PHOTOS[st] ? (
                <Image source={STYLE_PHOTOS[st]} style={styles.photo} contentFit="cover" transition={120} />
              ) : STYLE_PALETTES[st] ? (
                <View style={[styles.photo, styles.palette]}>
                  {STYLE_PALETTES[st].map((c) => <View key={c} style={{ flex: 1, backgroundColor: rgbCss(meta.colors[c]) }} />)}
                </View>
              ) : (
                <View style={[styles.photo, { backgroundColor: STYLE_COLOR[st] ?? t.cardAlt }]} />
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

const styles = StyleSheet.create({
  palette: { flexDirection: 'row', overflow: 'hidden' },
  // Always two per row, whatever padding the screen around it uses.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm },
  card: { width: '48.5%', borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  // A short strip, not a tall photo: 28 styles in two columns must not make the page endless.
  photo: { width: '100%', aspectRatio: 2.6 },
  name: { paddingHorizontal: space.sm, paddingVertical: 8 },
  check: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
