import { Image } from 'expo-image';
import { Heart } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useI18n, useLabel } from '../lib/i18n';
import { rgbCss } from '../lib/meta';
import { mediaUrl } from '../services/api';
import { radius, space, type, useTheme } from '../theme';
import type { Garment } from '../types';
import { CategoryIcon } from './icons';

/**
 * The garment's photo, as taken, on a neutral sand well. Without a photo:
 * the category line icon and a small dot in the garment's colour — never a
 * colour-flooded tile, never a broken image.
 */
export function GarmentImage({
  garment, style, iconSize = 32, rounded = radius.md,
}: { garment: Garment; style?: StyleProp<ViewStyle>; iconSize?: number; rounded?: number }) {
  const t = useTheme();
  // The photo as taken; a cutout only stands in when there is no photo.
  const src = mediaUrl(garment.image || garment.cutout);
  // Cut-out pieces float on one shared light tile, so a collage or grid reads as
  // a single set however each photo was taken; uncut photos still fill the frame.
  const cut = !garment.image && !!garment.cutout;
  return (
    <View style={[styles.imageBox, { borderRadius: rounded, backgroundColor: cut ? t.tile : t.sand }, style]}>
      {src ? (
        <Image source={{ uri: src }} style={cut ? styles.cutout : styles.image} contentFit={cut ? 'contain' : 'cover'} transition={150} />
      ) : (
        <>
          <CategoryIcon category={garment.category} size={iconSize} color={t.textSecondary} strokeWidth={1.4} />
          {garment.colors[0] ? (
            <View style={[styles.swatch, { backgroundColor: rgbCss(garment.colors[0].rgb), borderColor: t.card }]} />
          ) : null}
        </>
      )}
    </View>
  );
}

/** Wardrobe grid item: the image leads, a short name under it, a quiet favourite mark. Long-press for actions. */
export function GarmentCard({
  garment, width, onPress, onToggleFavorite, onMore, selected,
}: {
  garment: Garment;
  width: number;
  onPress?: () => void;
  onToggleFavorite?: () => void;
  onMore?: () => void;
  selected?: boolean;
}) {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const kind = garment.subcategory ? label('subcategories', garment.subcategory) : label('categories', garment.category);
  const name = garment.name || kind;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMore}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint={onMore ? s.common.more : undefined}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.85 : 1, gap: space.sm }]}
    >
      <View>
        <GarmentImage
          garment={garment}
          style={[{ width: '100%', aspectRatio: 0.8 }, selected && { borderWidth: 2, borderColor: t.primary }]}
        />
        {onToggleFavorite ? (
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={garment.favorite ? s.common.unfavorite : s.common.favorite}
            accessibilityState={{ selected: garment.favorite }}
            style={styles.fav}
          >
            <Heart size={18} color={garment.favorite ? t.text : t.textSecondary} fill={garment.favorite ? t.text : 'transparent'} strokeWidth={1.6} />
          </Pressable>
        ) : null}
      </View>
      <Text style={[type.label, { color: t.text }]} numberOfLines={1}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imageBox: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  cutout: { width: '86%', height: '86%' },
  swatch: { position: 'absolute', left: 10, bottom: 10, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  fav: { position: 'absolute', top: 6, right: 6, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
