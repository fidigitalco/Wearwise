import { Image } from 'expo-image';
import { ExternalLink, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { subPhoto } from '../lib/subPhotos';
import { catalog, shopping } from '../services/api';
import { radius, space, type, useTheme } from '../theme';
import type { ShoppingSuggestion, SuggestedProduct } from '../types';
import { GarmentSketch } from './GarmentSketch';
import { BottomSheet } from './Overlays';
import { money } from './Products';
import { Button } from './ui';

type Links = ShoppingSuggestion['links'];

/** A real photo of that kind of piece (its colour when we have one); the drawing when we have none. */
export function GarmentPhoto({ subcategory, category, color, rgb, size }: {
  subcategory: string; category: string; color?: string; rgb: [number, number, number]; size: number;
}) {
  const uri = subPhoto(subcategory, color);
  return uri
    ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
    : <GarmentSketch subcategory={subcategory} category={category} rgb={rgb} size={size} />;
}
export type ShopTarget = {
  title: string; subcategory: string; color: string; links: Links; products?: SuggestedProduct[];
  source: 'gap' | 'check' | 'assistant';
};

/**
 * The step between "Find it" and the store (prototype spec §2.4), under an
 * "Affiliate link" label as App Store and FTC rules ask. When the catalogue has
 * real pieces of this type and colour, those one or two open their own product
 * page; only without them does it offer a search in each store. The tap is
 * logged before the link opens; a failed log never blocks it.
 */
export function AffiliateSheet({ target, onClose }: { target: ShopTarget | null; onClose: () => void }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const open = (store: string, url: string) => {
    if (target) shopping.click({ store, subcategory: target.subcategory, color: target.color, source: target.source }).catch(() => {});
    Linking.openURL(url).catch(() => {});
    onClose();
  };
  // The product's own page; the server logs the click and adds the affiliate sub-id.
  const openProduct = (p: SuggestedProduct) => {
    onClose();
    catalog.act(p.id, 'shop').then((r) => r.url && Linking.openURL(r.url)).catch(() => {});
  };
  const products = target?.products ?? [];
  return (
    <BottomSheet visible={!!target} onClose={onClose} title={target?.title ?? s.shop.sheetTitle} closeLabel={s.common.close}>
      <View style={{ gap: space.md }}>
        <View style={[styles.tag, { backgroundColor: t.cardAlt }]}>
          <Text style={[type.caption, { color: t.textSub, fontWeight: '600' }]}>{s.shop.affiliate}</Text>
        </View>
        <Text style={[type.caption, { color: t.textMuted }]}>{s.shop.affiliateBody}</Text>
        {products.map((p) => (
          <Pressable key={p.id} onPress={() => openProduct(p)} accessibilityRole="link"
            accessibilityLabel={`${p.name}, ${money(p.price, p.currency)}, ${s.shop.openAt(p.store)}`}
            style={({ pressed }) => [styles.productRow, { borderColor: t.border, backgroundColor: pressed ? t.cardAlt : t.card }]}>
            <View style={[styles.productThumb, { backgroundColor: t.sand }]}>
              {p.image_url ? <Image source={{ uri: p.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={2}>{p.name}</Text>
              <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={1}>
                {[p.brand, p.store].filter(Boolean).join(' · ')} · {money(p.price, p.currency)}
              </Text>
            </View>
            <ExternalLink size={16} color={t.textSecondary} />
          </Pressable>
        ))}
        {products.length ? null : target?.links.map((l) => (
          <Pressable key={l.store} onPress={() => open(l.store, l.url)} accessibilityRole="link" accessibilityLabel={s.shop.searchIn(l.store)}
            style={({ pressed }) => [styles.storeRow, { borderColor: t.border, backgroundColor: pressed ? t.cardAlt : t.card }]}>
            <Text style={[type.bodyStrong, { color: t.text, flex: 1 }]}>{s.shop.searchIn(l.store)}</Text>
            <ExternalLink size={16} color={t.textSecondary} />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

/** One piece to buy: what, why, how many outfits it opens, and a button to find it. */
export function ShoppingCard({ item, width, onFind }: { item: ShoppingSuggestion; width?: number; onFind: (i: ShoppingSuggestion) => void }) {
  const t = useTheme();
  const { t: s } = useI18n();
  return (
    <View style={[styles.card, { width, backgroundColor: t.card, borderColor: t.border }]}>
      <View style={styles.top}>
        <View style={[styles.well, { backgroundColor: t.sand }]}>
          <GarmentPhoto subcategory={item.subcategory} category={item.category} color={item.color} rgb={item.rgb} size={60} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={3}>{item.reason}</Text>
        </View>
      </View>
      {item.unlocks > 0 ? (
        <View style={styles.unlocks}>
          <Sparkles size={14} color={t.accent} />
          <Text style={[type.caption, { color: t.accent, fontWeight: '600' }]}>{s.shop.unlocks(item.unlocks)}</Text>
        </View>
      ) : null}
      <Button title={s.shop.find} variant="secondary" size="sm" onPress={() => onFind(item)} />
    </View>
  );
}

/** A horizontal row of shopping cards, bleeding to the screen edge, with its own store sheet. */
export function ShoppingRow({ items, inset = 0 }: { items: ShoppingSuggestion[]; inset?: number }) {
  const [target, setTarget] = useState<ShopTarget | null>(null);
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingHorizontal: inset }}
        style={inset ? { marginHorizontal: -inset } : undefined}>
        {items.map((i) => <ShoppingCard key={i.id} item={i} width={260} onFind={(x) => setTarget({ ...x, source: 'gap' })} />)}
      </ScrollView>
      <AffiliateSheet target={target} onClose={() => setTarget(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.md },
  top: { flexDirection: 'row', gap: space.md },
  well: { width: 88, height: 88, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  unlocks: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, paddingRight: space.lg, borderRadius: radius.md, borderWidth: 1 },
  productThumb: { width: 64, height: 64, borderRadius: radius.sm, overflow: 'hidden' },
  storeRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 1 },
});
