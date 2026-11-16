import { router, useFocusEffect } from 'expo-router';
import { ChevronDown, ChevronUp, Crown, Pause, Play, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useToast } from '../components/Overlays';
import { ProductTile, ShopSheet } from '../components/Products';
import { Button, Chip, ChipWrap, FormScroll } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { registerForPush } from '../lib/push';
import { errorMessage, hunts as api, type Hunt } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';
import type { Product } from '../types';

/** "Find me this" (build prompt §2.5): describe it once; the server keeps looking and pushes new matches. */
export default function HuntsScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const premium = user?.plan === 'premium';
  const [list, setList] = useState<Hunt[] | null>(null);
  const [query, setQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [scope, setScope] = useState<'stores' | 'boutiques'>('stores');
  const [busy, setBusy] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [open, setOpen] = useState<Hunt | null>(null);
  const [shop, setShop] = useState<Product[] | null>(null);

  const load = useCallback(() => {
    api.list().then((r) => setList(r.hunts)).catch((e) => toast(errorMessage(e), 'error'));
  }, [toast]);
  useFocusEffect(load);

  const create = async () => {
    setBusy(true);
    try {
      const price = Number(maxPrice.replace(',', '.'));
      const hunt = await api.create({ query: query.trim(), max_price: maxPrice && price > 0 ? price : null, scope });
      setQuery('');
      setMaxPrice('');
      setOpen(hunt);
      load();
      void registerForPush(true);  // the moment alerts make sense: ask now
    } catch (e: any) {
      if (e?.response?.data?.code === 'hunt_limit') setLimitHit(true);
      else toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (h: Hunt) => {
    try {
      const next = await api.setStatus(h.id, h.status === 'paused' ? 'searching' : 'paused');
      if (open?.id === h.id) setOpen(next);
      load();
    } catch (e: any) {
      if (e?.response?.data?.code === 'hunt_limit') setLimitHit(true);
      else toast(errorMessage(e), 'error');
    }
  };

  const remove = async (h: Hunt) => {
    await api.remove(h.id).catch((e) => toast(errorMessage(e), 'error'));
    if (open?.id === h.id) setOpen(null);
    load();
  };

  const expand = async (h: Hunt) => {
    if (open?.id === h.id) return setOpen(null);
    setOpen(await api.get(h.id).catch(() => h));
  };

  const statusText = (h: Hunt) => h.status === 'paused' ? s.hunts.paused : h.status === 'found' ? s.hunts.found(h.found) : s.hunts.searching;

  return (
    <>
      <FormScroll style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
        <Text style={[type.body, { color: t.textSub }]}>{s.hunts.cardSub}</Text>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[type.overline, { color: t.textMuted }]}>{s.hunts.new}</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder={s.hunts.placeholder} placeholderTextColor={t.textMuted}
            accessibilityLabel={s.hunts.new} multiline maxLength={200}
            style={[type.body, styles.input, { color: t.text, borderColor: t.border, minHeight: 64 }]} />
          <TextInput value={maxPrice} onChangeText={setMaxPrice} placeholder={s.hunts.maxPrice} placeholderTextColor={t.textMuted}
            accessibilityLabel={s.hunts.maxPrice} keyboardType="decimal-pad"
            style={[type.body, styles.input, { color: t.text, borderColor: t.border }]} />
          <ChipWrap>
            <Chip label={s.hunts.scopeStores} selected={scope === 'stores'} onPress={() => setScope('stores')} />
            <Chip label={s.hunts.scopeBoutiques} selected={scope === 'boutiques'}
              onPress={() => (premium ? setScope('boutiques') : toast(s.hunts.boutiquesPremium))} />
          </ChipWrap>
          <Button title={s.hunts.start} onPress={create} loading={busy} disabled={query.trim().length < 3} />
        </View>

        {limitHit ? (
          <Pressable onPress={() => router.push('/premium')} accessibilityRole="button"
            style={({ pressed }) => [styles.upsell, { backgroundColor: t.highlightBg, opacity: pressed ? 0.85 : 1 }]}>
            <Crown size={22} color={t.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyStrong, { color: t.text }]}>{s.hunts.limit}</Text>
              <Text style={[type.caption, { color: t.textSub }]}>{s.hunts.limitBody}</Text>
            </View>
          </Pressable>
        ) : null}

        {list && !list.length ? <Text style={[type.body, { color: t.textMuted }]}>{s.hunts.empty}</Text> : null}
        {(list ?? []).map((h) => (
          <View key={h.id} style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Pressable onPress={() => expand(h)} accessibilityRole="button" style={styles.head}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={2}>{h.query}</Text>
                <Text style={[type.caption, { color: h.status === 'found' ? t.primary : t.textMuted }]}>
                  {statusText(h)} · {s.hunts.checked(h.checked)}{h.max_price ? ` · ≤ ${h.max_price}` : ''}
                </Text>
              </View>
              {open?.id === h.id ? <ChevronUp size={18} color={t.textSub} /> : <ChevronDown size={18} color={t.textSub} />}
            </Pressable>
            {open?.id === h.id ? (
              <>
                {open.matches?.length ? (
                  <View style={styles.grid}>
                    {open.matches.map((p) => <ProductTile key={p.id} product={p} width={150} onPress={() => setShop([p])} />)}
                  </View>
                ) : <Text style={[type.caption, { color: t.textMuted }]}>{s.hunts.noMatches}</Text>}
                <View style={styles.actions}>
                  <Pressable onPress={() => toggle(h)} accessibilityRole="button" hitSlop={8} style={styles.action}>
                    {h.status === 'paused' ? <Play size={16} color={t.primary} /> : <Pause size={16} color={t.primary} />}
                    <Text style={[type.label, { color: t.primary }]}>{h.status === 'paused' ? s.hunts.resume : s.hunts.pause}</Text>
                  </Pressable>
                  <Pressable onPress={() => remove(h)} accessibilityRole="button" hitSlop={8} style={styles.action}>
                    <Trash2 size={16} color={t.danger} />
                    <Text style={[type.label, { color: t.danger }]}>{s.hunts.remove}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        ))}
      </FormScroll>
      <ShopSheet products={shop} onClose={() => setShop(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.lg, paddingBottom: space.xxl * 2 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, textAlignVertical: 'top' },
  upsell: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: space.xl },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
