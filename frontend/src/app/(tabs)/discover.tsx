import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Heart, ImagePlus, ShoppingBag, ThumbsUp, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { useToast } from '../../components/Overlays';
import { ProductCard, ShopSheet } from '../../components/Products';
import { EmptyState, LoadingSkeleton } from '../../components/ui';
import { LOCALES, useI18n } from '../../lib/i18n';
import { catalog, errorMessage, type ProductAction } from '../../services/api';
import { gutter, radius, space, type, useTheme } from '../../theme';
import type { Product } from '../../types';

/**
 * Discover (MVP v2 §2): today's drop, one card at a time. Like, Not me, Save
 * and Shop each teach the profile; the meter shows how much it has learned.
 */
export default function DiscoverScreen() {
  const t = useTheme();
  const { t: s, lang } = useI18n();
  const toast = useToast();
  const [deck, setDeck] = useState<Product[] | null>(null);
  const [learned, setLearned] = useState(0);
  const [nextDrop, setNextDrop] = useState('');
  const [shop, setShop] = useState<Product[] | null>(null);
  // State, not a ref: the value is read while rendering the card's transform.
  const [slide] = useState(() => new Animated.Value(0));

  useFocusEffect(
    useCallback(() => {
      catalog.discover()
        .then((d) => {
          setDeck(d.products);
          setLearned(d.learned);
          setNextDrop(d.next_drop);
        })
        .catch(() => setDeck([]));
    }, []),
  );

  const act = (action: ProductAction) => {
    const top = deck?.[0];
    if (!top) return;
    if (action === 'shop') {
      setShop([top]);  // the sheet logs the tap and opens the store
    } else {
      catalog.act(top.id, action).then((r) => setLearned(r.learned)).catch((e) => toast(errorMessage(e), 'error'));
      toast(action === 'like' ? s.discover.likedToast : action === 'not_me' ? s.discover.notMeToast : s.product.savedToast);
    }
    Animated.timing(slide, { toValue: action === 'not_me' ? -1 : 1, duration: 220, useNativeDriver: true }).start(() => {
      setDeck((d) => (d ? d.slice(1) : d));
      slide.setValue(0);
    });
  };

  const top = deck?.[0];
  const day = nextDrop ? new Date(`${nextDrop}T12:00:00`).toLocaleDateString(LOCALES[lang], { weekday: 'long' }) : '';
  const move = {
    transform: [
      { translateX: slide.interpolate({ inputRange: [-1, 1], outputRange: [-420, 420] }) },
      { rotate: slide.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) },
    ],
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <AppHeader title={s.discover.title} />
        <Text style={[type.body, { color: t.textSub, marginTop: -space.md }]}>{s.discover.sub}</Text>
        <View style={{ gap: 6 }}>
          <Text style={[type.caption, { color: t.text, fontWeight: '600' }]}>{s.discover.learned(learned)}</Text>
          <View style={[styles.meter, { backgroundColor: t.cardAlt }]}>
            <View style={[styles.meterFill, { width: `${learned}%`, backgroundColor: t.primary }]} />
          </View>
        </View>

        {/* Sharing what they like teaches the profile as much as a few swipes. */}
        <Pressable onPress={() => router.push('/inspiration')} accessibilityRole="button"
          style={({ pressed }) => [styles.share, { backgroundColor: t.highlightBg, opacity: pressed ? 0.85 : 1 }]}>
          <ImagePlus size={22} color={t.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.bodyStrong, { color: t.text }]}>{s.inspo.open}</Text>
            <Text style={[type.caption, { color: t.textSub }]}>{s.inspo.openSub}</Text>
          </View>
          <ChevronRight size={18} color={t.text} />
        </Pressable>

        {deck === null ? (
          <LoadingSkeleton height={460} radius={radius.lg} />
        ) : top ? (
          <>
            <Animated.View style={move}>
              <ProductCard key={top.id} product={top} />
            </Animated.View>
            <View style={styles.actions}>
              <Action icon={<X size={20} color={t.text} />} label={s.discover.notMe} onPress={() => act('not_me')} />
              <Action icon={<ThumbsUp size={20} color={t.text} />} label={s.discover.like} onPress={() => act('like')} />
              <Action icon={<Heart size={20} color={t.text} />} label={s.product.save} onPress={() => act('save')} />
              <Action icon={<ShoppingBag size={20} color={t.onPrimary} />} label={s.product.shop} primary onPress={() => act('shop')} />
            </View>
          </>
        ) : (
          <EmptyState title={s.discover.doneTitle} body={s.discover.doneBody(day)} />
        )}
      </ScrollView>
      <ShopSheet products={shop} onClose={() => setShop(null)} />
    </SafeAreaView>
  );
}

function Action({ icon, label, onPress, primary }: { icon: React.ReactNode; label: string; onPress: () => void; primary?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.action, {
        backgroundColor: primary ? t.primary : t.card, borderColor: primary ? t.primary : t.border, opacity: pressed ? 0.8 : 1,
      }]}>
      {icon}
      <Text style={[type.caption, { color: primary ? t.onPrimary : t.text, fontWeight: '600' }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingTop: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  meter: { height: 6, borderRadius: 3, overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', gap: space.sm },
  share: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 60, borderRadius: radius.md, borderWidth: 1 },
});
