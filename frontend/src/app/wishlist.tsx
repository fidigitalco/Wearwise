import { useFocusEffect } from 'expo-router';
import { BellRing, TrendingDown } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useToast } from '../components/Overlays';
import { money, ProductCard, ShopSheet } from '../components/Products';
import { Button, EmptyState, LoadingSkeleton } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { catalog, errorMessage } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';
import type { Product, SavedItem } from '../types';

/**
 * The wishlist: every saved piece, with a switch to watch its price. Alerts
 * are always free; the free plan watches five pieces (MVP §5).
 */
export default function WishlistScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [limit, setLimit] = useState<number | null>(5);
  const [shop, setShop] = useState<Product[] | null>(null);

  useFocusEffect(useCallback(() => {
    catalog.saved().then((d) => {
      setItems(d.items);
      setLimit(d.tracking_limit);
    }).catch(() => setItems([]));
  }, []));

  const track = (it: SavedItem, on: boolean) => {
    setItems((xs) => xs?.map((x) => (x.product.id === it.product.id ? { ...x, tracking: on } : x)) ?? null);
    catalog.track(it.product.id, on).catch((e) => {
      setItems((xs) => xs?.map((x) => (x.product.id === it.product.id ? { ...x, tracking: !on } : x)) ?? null);
      toast(e?.response?.data?.code === 'tracking_limit' ? s.wishlist.limitReached : errorMessage(e), 'error');
    });
  };

  const unsaved = (id: string, saved: boolean) => {
    if (!saved) setItems((xs) => xs?.filter((x) => x.product.id !== id) ?? null);
  };

  const watched = items?.filter((x) => x.tracking).length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={styles.wrap}>
        {items === null ? <LoadingSkeleton height={300} radius={radius.lg} /> : items.length === 0 ? (
          <EmptyState title={s.wishlist.title} body={s.wishlist.empty} />
        ) : (
          <>
            <Text style={[type.caption, { color: t.textMuted }]}>{limit === null ? s.wishlist.unlimited : s.wishlist.limit(watched)}</Text>
            {items.map((it) => (
              <ProductCard key={it.product.id} product={{ ...it.product, saved: true }} onSavedChange={(v) => unsaved(it.product.id, v)} footer={
                <View style={{ gap: space.md }}>
                  {it.drop ? (
                    <View style={styles.row}>
                      <TrendingDown size={16} color={t.success} />
                      <Text style={[type.bodyStrong, { color: t.success }]}>
                        {s.wishlist.dropped(money(it.drop[0], it.product.currency), money(it.drop[1], it.product.currency))}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.row}>
                    <BellRing size={16} color={it.tracking ? t.primary : t.textMuted} />
                    <Text style={[type.body, { color: t.text, flex: 1 }]}>{it.tracking ? s.wishlist.watching : s.wishlist.watch}</Text>
                    <Switch value={it.tracking} onValueChange={(v) => track(it, v)} accessibilityLabel={s.wishlist.watch} />
                  </View>
                  <Button title={s.product.shop} size="sm" onPress={() => setShop([it.product])} />
                </View>
              } />
            ))}
          </>
        )}
      </ScrollView>
      <ShopSheet products={shop} onClose={() => setShop(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.lg, paddingBottom: space.xxl * 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
