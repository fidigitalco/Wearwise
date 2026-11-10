import { Image } from 'expo-image';
import { ExternalLink, Heart } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { catalog, errorMessage } from '../services/api';
import { elevation, radius, space, type, useTheme } from '../theme';
import type { Look, Product } from '../types';
import { GarmentSketch } from './GarmentSketch';
import { BottomSheet, useToast } from './Overlays';
import { Button } from './ui';

export function money(n: number, currency = 'USD') {
  const sym = { USD: '$', GBP: '£', EUR: '€', TRY: '₺', AZN: '₼' }[currency] ?? `${currency} `;
  return `${sym}${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

/** The product photo when the feed has one; otherwise a drawing of the piece in its colour. */
export function ProductImage({ product, size }: { product: Product; size: number }) {
  const t = useTheme();
  return (
    <View style={[styles.well, { width: '100%', aspectRatio: 1, backgroundColor: t.tile }]}>
      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <GarmentSketch subcategory={product.subcategory} category={product.category} rgb={product.rgb} size={size} />
      )}
    </View>
  );
}

/** Save / unsave with the heart, optimistic, with a toast; `onChange` hears the new state. */
export function useSaveToggle(product: Product, onChange?: (saved: boolean) => void) {
  const { t: s } = useI18n();
  const toast = useToast();
  const [saved, setSaved] = useState(product.saved);
  const toggle = () => {
    const next = !saved;
    setSaved(next);
    onChange?.(next);
    (next ? catalog.save(product.id) : catalog.unsave(product.id))
      .then(() => toast(next ? s.product.savedToast : s.product.unsavedToast))
      .catch((e) => {
        setSaved(!next);
        onChange?.(!next);
        toast(errorMessage(e), 'error');
      });
  };
  return { saved, toggle };
}

export function HeartButton({ product, onChange, size = 20 }: { product: Product; onChange?: (saved: boolean) => void; size?: number }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const { saved, toggle } = useSaveToggle(product, onChange);
  return (
    <Pressable onPress={toggle} hitSlop={8} accessibilityRole="button" accessibilityState={{ selected: saved }}
      accessibilityLabel={saved ? s.product.saved : s.product.save}
      style={({ pressed }) => [styles.heart, { backgroundColor: t.card, opacity: pressed ? 0.7 : 1 }]}>
      <Heart size={size} color={saved ? t.accent : t.textSecondary} fill={saved ? t.accent : 'transparent'} strokeWidth={1.8} />
    </Pressable>
  );
}

/**
 * Before the store opens: what it is, where, the "Affiliate link" label App
 * Store and FTC rules ask for, and on the demo catalogue a note that the link
 * is a store search. The tap is logged by the server, which returns the tracked link.
 */
export function ShopSheet({ products, onClose }: { products: Product[] | null; onClose: () => void }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const open = (p: Product) =>
    catalog.act(p.id, 'shop')
      .then((r) => {
        if (r.url) Linking.openURL(r.url);
      })
      .catch((e) => toast(errorMessage(e), 'error'));
  const demo = products?.some((p) => p.is_demo);
  return (
    <BottomSheet visible={!!products} onClose={onClose} title={products?.length === 1 ? products[0].name : s.feed.shopLook} closeLabel={s.common.close}>
      <View style={{ gap: space.md }}>
        <View style={[styles.tag, { backgroundColor: t.cardAlt }]}>
          <Text style={[type.caption, { color: t.textSub, fontWeight: '600' }]}>{s.shop.affiliate}</Text>
        </View>
        <Text style={[type.caption, { color: t.textMuted }]}>{s.shop.affiliateBody}{demo ? ` ${s.product.demoNote}` : ''}</Text>
        {products?.map((p) => (
          <Pressable key={p.id} onPress={() => open(p)} accessibilityRole="link" accessibilityLabel={s.product.open(p.store)}
            style={({ pressed }) => [styles.storeRow, { borderColor: t.border, backgroundColor: pressed ? t.cardAlt : t.card }]}>
            <View style={{ width: 40 }}><GarmentSketch subcategory={p.subcategory} category={p.category} rgb={p.rgb} size={36} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{products.length === 1 ? s.product.open(p.store) : p.name}</Text>
              <Text style={[type.caption, { color: t.textMuted }]}>{p.store} · {money(p.price, p.currency)}</Text>
            </View>
            <ExternalLink size={16} color={t.textSecondary} />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

/** A small product card for rows: picture, heart, name, price and store. */
export function ProductTile({ product, width = 150, onPress }: { product: Product; width?: number; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${product.name}, ${money(product.price, product.currency)}, ${product.store}`}
      style={({ pressed }) => [{ width, gap: 6, opacity: pressed ? 0.85 : 1 }]}>
      <View>
        <ProductImage product={product} size={width * 0.62} />
        <View style={styles.heartPos}><HeartButton product={product} size={16} /></View>
      </View>
      <Text style={[type.bodyStrong, { color: t.text, fontSize: 14 }]} numberOfLines={2}>{product.name}</Text>
      <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={1}>
        {money(product.price, product.currency)} · {product.store}
      </Text>
    </Pressable>
  );
}

/** The big card: picture, name, store, price, "Why this?" and the labels it must carry. */
export function ProductCard({ product, footer, onSavedChange }: { product: Product; footer?: React.ReactNode; onSavedChange?: (saved: boolean) => void }) {
  const t = useTheme();
  const { t: s } = useI18n();
  return (
    <View style={[styles.card, { backgroundColor: t.card }, elevation(t, 2)]}>
      <View>
        <ProductImage product={product} size={200} />
        <View style={styles.heartPos}><HeartButton product={product} onChange={onSavedChange} /></View>
        {product.sponsored ? (
          <View style={[styles.badge, { backgroundColor: t.card }]}><Text style={[type.caption, { color: t.text, fontWeight: '700' }]}>{s.product.sponsored}</Text></View>
        ) : product.match ? (
          <View style={[styles.badge, styles.glassTag, { backgroundColor: t.frosted, borderColor: t.card }]}>
            <Text style={[type.caption, { color: t.primaryPressed, fontWeight: '700' }]}>{s.product.match(product.match)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardInfo}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.title, { color: t.text, fontFamily: type.display.fontFamily, fontWeight: '500' }]} numberOfLines={2}>{product.name}</Text>
          <Text style={[type.caption, { color: t.textMuted }]}>
            {product.store}{product.rating ? ` · ${product.rating}★` : ''}{product.small_brand ? ` · ${s.product.smallBrand}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[type.title, { color: t.text, fontFamily: type.display.fontFamily, fontWeight: '500' }]}>{money(product.price, product.currency)}</Text>
          {product.previous_price && product.previous_price > product.price ? (
            <Text style={[type.caption, { color: t.textMuted, textDecorationLine: 'line-through' }]}>{money(product.previous_price, product.currency)}</Text>
          ) : null}
        </View>
      </View>
      {product.why ? (
        <View style={[styles.why, { backgroundColor: t.highlightBg }]}>
          <Text style={[type.caption, { color: t.primaryPressed, fontWeight: '700' }]}>{s.product.why}</Text>
          <Text style={[type.body, { color: t.textSub }]}>{product.why}</Text>
        </View>
      ) : null}
      {footer ? <View style={{ padding: space.md, paddingTop: 0 }}>{footer}</View> : <View style={{ height: space.md }} />}
    </View>
  );
}

/** An outfit as a flat lay: the pieces laid out on a tile, the total and a button to shop them. */
export function LookCard({ look, title, kicker, onShop }: { look: Look; title: string; kicker?: string; onShop: () => void }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const currency = look.items[0]?.currency ?? 'USD';
  return (
    <View style={[styles.card, { backgroundColor: t.card }, elevation(t, 2)]}>
      <View style={[styles.flatLay, { backgroundColor: t.tile }]}>
        {kicker ? (
          <View style={[styles.kicker, { backgroundColor: t.frosted }]}>
            <Text style={[type.overline, { color: t.accent, fontSize: 10 }]}>{kicker}</Text>
          </View>
        ) : null}
        {look.items.map((p) => (
          <View key={p.id} style={styles.flatItem}>
            <GarmentSketch subcategory={p.subcategory} category={p.category} rgb={p.rgb} size={look.items.length > 4 ? 74 : 92} />
          </View>
        ))}
      </View>
      <View style={styles.cardInfo}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.title, { color: t.text, fontFamily: type.display.fontFamily, fontWeight: '500' }]}>{title}</Text>
          <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={1}>
            {s.feed.lookMeta(look.items.length, money(look.total, currency))} · {look.stores.join(', ')}
          </Text>
        </View>
        <Button title={s.feed.shopLook} size="sm" onPress={onShop} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  well: { borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heart: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  heartPos: { position: 'absolute', top: 8, right: 8 },
  badge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  glassTag: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  why: { marginHorizontal: space.sm, padding: space.md, borderRadius: 16, gap: 2 },
  kicker: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, zIndex: 1 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1 },
  card: { borderRadius: 28, padding: space.sm, gap: space.sm },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingTop: space.xs },
  flatLay: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', padding: space.md, gap: space.sm, minHeight: 220, borderRadius: 22 },
  flatItem: { alignItems: 'center', justifyContent: 'center' },
});
