import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { humanize } from '../lib/meta';
import { space, useTheme } from '../lib/theme';
import type { Outfit, ScoreKey } from '../lib/types';
import { GarmentThumb } from './GarmentThumb';
import { Card, ScoreBar } from './ui';

const SCORE_LABELS: [ScoreKey, string][] = [
  ['color', 'Colour'],
  ['occasion', 'Occasion'],
  ['weather', 'Weather'],
  ['silhouette', 'Silhouette'],
  ['material', 'Material'],
  ['taste', 'Your taste'],
  ['rotation', 'Rotation'],
];

export function OutfitCard({
  outfit, index, liked, onLike, onDislike, onWear, onToggleSave, worn,
}: {
  outfit: Outfit;
  index?: number;
  liked?: boolean | null;
  onLike?: () => void;
  onDislike?: () => void;
  onWear?: () => void;
  onToggleSave?: () => void;
  worn?: boolean;
}) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const n = outfit.items.length;
  const thumb = Math.min(110, (width - space.lg * 2 - space.lg * 2 - space.sm * 2) / 3);

  return (
    <Card>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: t.text }]}>
          {index !== undefined ? `Look ${index + 1}` : humanize(outfit.context?.occasion)}
        </Text>
        <View style={[styles.score, { backgroundColor: t.highlightBg }]}>
          <Text style={[styles.scoreText, { color: t.highlight }]}>{Math.round(outfit.total_score)}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {outfit.items.map((it) => (
          <GarmentThumb key={it.garment.id} garment={it.garment} size={n <= 3 ? thumb * 1.2 : thumb} />
        ))}
      </View>

      {outfit.explanation ? <Text style={[styles.why, { color: t.textSub }]}>{outfit.explanation}</Text> : null}

      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" style={styles.toggle}>
        <Text style={{ color: t.textMuted, fontSize: 13 }}>{open ? 'Hide scores' : 'Why this score'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={t.textMuted} />
      </Pressable>
      {open ? (
        <View style={{ gap: 6 }}>
          {SCORE_LABELS.map(([k, label]) => (
            <ScoreBar key={k} label={label} value={outfit.scores?.[k] ?? 0} />
          ))}
        </View>
      ) : null}

      <View style={[styles.actions, { borderTopColor: t.border }]}>
        {onLike ? (
          <IconAction icon={liked === true ? 'heart' : 'heart-outline'} label="Like" active={liked === true} onPress={onLike} />
        ) : null}
        {onDislike ? (
          <IconAction
            icon={liked === false ? 'thumbs-down' : 'thumbs-down-outline'}
            label="Not for me"
            active={liked === false}
            onPress={onDislike}
          />
        ) : null}
        {onToggleSave ? (
          <IconAction
            icon={outfit.saved ? 'bookmark' : 'bookmark-outline'}
            label={outfit.saved ? 'Saved' : 'Save'}
            active={outfit.saved}
            onPress={onToggleSave}
          />
        ) : null}
        {onWear ? (
          <IconAction icon={worn ? 'checkmark-circle' : 'shirt-outline'} label={worn ? 'Worn today' : 'Wear this'} active={worn} onPress={worn ? undefined : onWear} />
        ) : null}
      </View>
    </Card>
  );
}

function IconAction({
  icon, label, onPress, active,
}: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; active?: boolean }) {
  const t = useTheme();
  const color = active ? t.highlight : t.textSub;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={8}
      style={styles.action}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ color, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 17, fontWeight: '700' },
  score: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  scoreText: { fontWeight: '700', fontSize: 14, fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  why: { fontSize: 15, lineHeight: 21 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 2 },
  actions: {
    flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md,
  },
  action: { alignItems: 'center', gap: 2, minWidth: 64, minHeight: 44, justifyContent: 'center' },
});
