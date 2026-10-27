import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { mediaUrl } from '../lib/api';
import { humanize, rgbCss } from '../lib/meta';
import { radius, useTheme } from '../lib/theme';
import type { Garment } from '../lib/types';

/** Square garment tile: cutout (or photo) over a soft card, colour dot and kind. */
export function GarmentThumb({
  garment, size, onPress, selected, showLabel = true,
}: { garment: Garment; size: number; onPress?: () => void; selected?: boolean; showLabel?: boolean }) {
  const t = useTheme();
  const src = mediaUrl(garment.cutout || garment.image);
  const swatch = rgbCss(garment.colors[0]?.rgb);
  const label = garment.name || humanize(garment.subcategory || garment.category);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${humanize(garment.primary_color)} ${label}`}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      style={{ width: size }}
    >
      <View
        style={[
          styles.tile,
          { width: size, height: size, backgroundColor: t.cardAlt, borderColor: selected ? t.highlight : 'transparent' },
        ]}
      >
        {src ? (
          <Image source={{ uri: src }} style={styles.img} contentFit="contain" transition={150} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: swatch }]} />
        )}
        <View style={[styles.dot, { backgroundColor: swatch, borderColor: t.card }]} />
      </View>
      {showLabel ? (
        <Text numberOfLines={1} style={[styles.label, { color: t.textSub }]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  img: { width: '88%', height: '88%' },
  placeholder: { width: '50%', height: '50%', borderRadius: radius.sm, opacity: 0.85 },
  dot: { position: 'absolute', right: 6, top: 6, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  label: { fontSize: 12, marginTop: 4 },
});
