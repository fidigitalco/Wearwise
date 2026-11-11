import { Image } from 'expo-image';
import { Heart, RotateCcw, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useI18n, useLabel } from '../lib/i18n';
import type { SwipeItem } from '../lib/swipeItems';
import { elevation, radius, space, type, useTheme } from '../theme';

const THRESHOLD = 110;

/**
 * Yes / no over garment types, one card at a time: swipe right or tap the
 * heart for yes, left or the cross for no. `answers` holds sub → 1 | -1;
 * the deck shows the first item without an answer.
 */
export function SwipeDeck({ items, answers, onAnswer, onUndo }: {
  items: SwipeItem[];
  answers: Record<string, number>;
  onAnswer: (sub: string, value: 1 | -1) => void;
  onUndo: () => void;
}) {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const { width } = useWindowDimensions();
  const index = items.findIndex((i) => !(i.sub in answers));
  const item = index >= 0 ? items[index] : null;
  const done = index < 0 ? items.length : index;
  // State, not a ref: the value is read while rendering the card's transform.
  const [pan] = useState(() => new Animated.ValueXY());
  // A drag or a button only records the decision; the effect below animates the card away and answers.
  const [decision, setDecision] = useState<0 | 1 | -1>(0);

  useEffect(() => {
    if (!decision || !item) return;
    Animated.timing(pan, { toValue: { x: decision * width * 1.2, y: 0 }, duration: 200, useNativeDriver: true }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setDecision(0);
      onAnswer(item.sub, decision);
    });
  }, [decision, item, onAnswer, pan, width]);

  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > THRESHOLD) setDecision(1);
        else if (g.dx < -THRESHOLD) setDecision(-1);
        else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
      },
    }),
  );

  if (!item) {
    return (
      <View style={[styles.done, { backgroundColor: t.highlightBg }]}>
        <Heart size={28} color={t.primary} />
        <Text style={[type.bodyStrong, { color: t.text, textAlign: 'center' }]}>{s.onb.swipeDone}</Text>
        <Pressable onPress={onUndo} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: t.primary, fontWeight: '600' }}>{s.onb.undo}</Text>
        </Pressable>
      </View>
    );
  }

  const rotate = pan.x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-12deg', '0deg', '12deg'] });
  const yesOpacity = pan.x.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const noOpacity = pan.x.interpolate({ inputRange: [-THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const name = label('subcategories', item.sub);

  return (
    <View style={{ gap: space.md }}>
      <Text style={[type.caption, { color: t.textMuted, textAlign: 'center' }]}>{s.onb.swipeCount(done + 1, items.length)}</Text>
      <Animated.View {...responder.panHandlers} accessibilityLabel={name}
        style={[styles.card, { backgroundColor: t.card, transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] }, elevation(t, 2)]}>
        <Image source={{ uri: item.photo }} style={styles.photo} contentFit="cover" transition={150} />
        <Animated.View style={[styles.stamp, styles.stampYes, { borderColor: t.success, opacity: yesOpacity }]}>
          <Text style={[styles.stampText, { color: t.success }]}>{s.onb.yes}</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampNo, { borderColor: t.danger, opacity: noOpacity }]}>
          <Text style={[styles.stampText, { color: t.danger }]}>{s.onb.no}</Text>
        </Animated.View>
        <Text style={[type.title, { color: t.text, textAlign: 'center', padding: space.md, fontFamily: type.display.fontFamily }]}>{name}</Text>
      </Animated.View>
      <View style={styles.buttons}>
        <Pressable onPress={onUndo} disabled={done === 0} accessibilityRole="button" accessibilityLabel={s.onb.undo}
          style={[styles.small, { backgroundColor: t.card, opacity: done === 0 ? 0.4 : 1 }, elevation(t)]}>
          <RotateCcw size={18} color={t.textSecondary} />
        </Pressable>
        <Pressable onPress={() => setDecision(-1)} accessibilityRole="button" accessibilityLabel={`${s.onb.no}: ${name}`}
          style={[styles.big, { backgroundColor: t.card }, elevation(t)]}>
          <X size={30} color={t.danger} strokeWidth={2.2} />
        </Pressable>
        <Pressable onPress={() => setDecision(1)} accessibilityRole="button" accessibilityLabel={`${s.onb.yes}: ${name}`}
          style={[styles.big, { backgroundColor: t.card }, elevation(t)]}>
          <Heart size={30} color={t.success} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.small} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 0.95 },
  stamp: { position: 'absolute', top: 24, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 3, borderRadius: radius.md },
  stampYes: { left: 20, transform: [{ rotate: '-12deg' }] },
  stampNo: { right: 20, transform: [{ rotate: '12deg' }] },
  stampText: { fontSize: 26, fontWeight: '800', letterSpacing: 1 },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl },
  big: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  small: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  done: { alignItems: 'center', gap: space.md, padding: space.xl, borderRadius: 24 },
});
