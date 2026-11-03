import { ExternalLink } from 'lucide-react-native';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { radius, space, type, useTheme } from '../theme';
import type { ShoppingSuggestion } from '../types';
import { CategoryIcon } from './icons';

/** One piece to buy: what and why, plus a chip per store that opens a search for it. */
export function ShoppingCard({ item, width = 260 }: { item: ShoppingSuggestion; width?: number }) {
  const t = useTheme();
  const { t: s } = useI18n();
  return (
    <View style={[styles.card, { width, backgroundColor: t.card, borderColor: t.border }]}>
      <View style={styles.top}>
        <View style={[styles.well, { backgroundColor: t.sand }]}>
          <CategoryIcon category={item.category} size={26} color={t.textSecondary} strokeWidth={1.4} />
          <View style={[styles.dot, { backgroundColor: `rgb(${item.rgb.join(',')})`, borderColor: t.card }]} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={3}>{item.reason}</Text>
        </View>
      </View>
      <View style={styles.stores}>
        {item.links.map((l) => (
          <Pressable
            key={l.store}
            onPress={() => Linking.openURL(l.url)}
            accessibilityRole="link"
            accessibilityLabel={s.shop.searchIn(l.store)}
            style={({ pressed }) => [styles.store, { borderColor: t.border, backgroundColor: pressed ? t.cardAlt : t.card }]}
          >
            <Text style={[type.caption, { color: t.text, fontWeight: '600' }]}>{l.store}</Text>
            <ExternalLink size={12} color={t.textSecondary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** A horizontal row of shopping cards, bleeding to the screen edge. */
export function ShoppingRow({ items, inset = 0 }: { items: ShoppingSuggestion[]; inset?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingHorizontal: inset }}
      style={inset ? { marginHorizontal: -inset } : undefined}>
      {items.map((i) => <ShoppingCard key={i.id} item={i} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.md },
  top: { flexDirection: 'row', gap: space.md },
  well: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: 5, bottom: 5, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  stores: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  store: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1 },
});
