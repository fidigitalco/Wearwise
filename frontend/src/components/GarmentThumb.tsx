import { Pressable, StyleSheet, Text } from 'react-native';
import { useLabel } from '../lib/i18n';
import { radius, type, useTheme } from '../theme';
import type { Garment } from '../types';
import { GarmentImage } from './Garment';

/** Compact square garment tile for pickers (swap sheet, outfit checker). */
export function GarmentThumb({
  garment, size, onPress, selected, showLabel = true,
}: { garment: Garment; size: number; onPress?: () => void; selected?: boolean; showLabel?: boolean }) {
  const t = useTheme();
  const tx = useLabel();
  const label = garment.name || (garment.subcategory ? tx('subcategories', garment.subcategory) : tx('categories', garment.category));
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${tx('colors', garment.primary_color)} ${label}`}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      style={{ width: size }}
    >
      <GarmentImage
        garment={garment}
        style={{ width: size, height: size, borderWidth: 2, borderColor: selected ? t.primary : 'transparent' }}
        iconSize={Math.round(size * 0.36)}
        rounded={radius.md}
      />
      {showLabel ? (
        <Text numberOfLines={1} style={[type.caption, styles.label, { color: t.textSub }]}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 4 },
});
