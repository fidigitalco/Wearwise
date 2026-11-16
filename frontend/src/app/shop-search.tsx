import { router } from 'expo-router';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useToast } from '../components/Overlays';
import { money, ProductTile, ShopSheet } from '../components/Products';
import { Button, Chip, ChipWrap, FormScroll } from '../components/ui';
import { useI18n, useLabel } from '../lib/i18n';
import { errorMessage, smartShop, type SearchChip, type SmartSearchResult } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';
import type { Product } from '../types';

/**
 * Smart search (build prompt §2.3): the person's words plus their profile, then
 * the filter funnel shown as counts ("68 pieces → 6 for you") and, on request,
 * every removed piece with its reason.
 */
export default function ShopSearchScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SmartSearchResult | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [shop, setShop] = useState<Product[] | null>(null);

  const search = async (q = query) => {
    if (q.trim().length < 2) return;
    setBusy(true);
    try {
      setResult(await smartShop.search(q.trim()));
      setShowRemoved(false);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <FormScroll style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
        <View style={{ gap: space.sm }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => search()}
            placeholder={s.smart.placeholder}
            placeholderTextColor={t.textMuted}
            accessibilityLabel={s.smart.title}
            returnKeyType="search"
            style={[type.body, styles.input, { color: t.text, backgroundColor: t.card, borderColor: t.border }]}
          />
          {!result ? (
            <ChipWrap>
              {s.smart.examples.map((x) => <Chip key={x} label={x} onPress={() => { setQuery(x); search(x); }} />)}
            </ChipWrap>
          ) : null}
          <Button title={s.smart.search} onPress={() => search()} loading={busy} disabled={query.trim().length < 2} />
        </View>

        {result ? (
          <>
            <IntentChips chips={result.intent.chips} />
            <Funnel result={result} />
            {result.results.length ? (
              <View style={styles.grid}>
                {result.results.map((p) => <ProductTile key={p.id} product={p} width={160} onPress={() => setShop([p])} />)}
              </View>
            ) : (
              <Text style={[type.body, { color: t.textSub }]}>{s.smart.none}</Text>
            )}
            {result.removed.length ? (
              <View style={{ gap: space.sm }}>
                <Pressable onPress={() => setShowRemoved((v) => !v)} accessibilityRole="button" style={styles.toggle}>
                  <Text style={[type.bodyStrong, { color: t.primary }]}>{showRemoved ? s.smart.hideRemoved : s.smart.showRemoved}</Text>
                  {showRemoved ? <ChevronUp size={18} color={t.primary} /> : <ChevronDown size={18} color={t.primary} />}
                </Pressable>
                {showRemoved ? result.removed.map((r) => (
                  <View key={`${r.product.id}-${r.reason}`} style={[styles.removed, { borderColor: t.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[type.body, { color: t.text }]} numberOfLines={1}>{r.product.name}</Text>
                      <Text style={[type.caption, { color: t.textMuted }]}>{r.product.store} · {money(r.product.price, r.product.currency)}</Text>
                    </View>
                    <Text style={[type.caption, { color: t.danger, maxWidth: 150, textAlign: 'right' }]}>{reasonLabel(r.reason, s.smart.reasons)}</Text>
                  </View>
                )) : null}
              </View>
            ) : null}
            <Pressable onPress={() => router.push('/my-style')} accessibilityRole="button" style={styles.toggle}>
              <SlidersHorizontal size={16} color={t.textSub} />
              <Text style={[type.label, { color: t.textSub }]}>{s.myStyle.title}</Text>
            </Pressable>
          </>
        ) : null}
      </FormScroll>
      <ShopSheet products={shop} onClose={() => setShop(null)} />
    </>
  );
}

function reasonLabel(reason: string, labels: Record<string, string>) {
  return labels[reason.startsWith('never:') ? 'never' : reason] ?? reason;
}

function IntentChips({ chips }: { chips: SearchChip[] }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const text = (c: SearchChip) => {
    const [kind, value] = c.key.split(':');
    const v = value ?? '';
    if (kind === 'sub') return label('subcategories', v);
    if (kind === 'color') return label('colors', v);
    if (kind === 'style') return label('styles', v);
    if (kind === 'never') return `${s.smart.never}: ${c.label.replace(/_/g, ' ')}`;
    return c.label;
  };
  const tone = { you: t.primary, profile: t.textSub, never: t.danger };
  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.chips}>
        {chips.map((c) => (
          <View key={c.key} style={[styles.chip, { borderColor: tone[c.source], backgroundColor: c.source === 'you' ? t.highlightBg : t.card }]}>
            <Text style={[type.caption, { color: tone[c.source], fontWeight: '600' }]}>{text(c)}</Text>
          </View>
        ))}
      </View>
      <Text style={[type.caption, { color: t.textMuted }]}>
        <Text style={{ color: t.primary, fontWeight: '600' }}>■ </Text>{s.smart.you}{'   '}
        <Text style={{ color: t.textSub, fontWeight: '600' }}>■ </Text>{s.smart.profile}
      </Text>
    </View>
  );
}

function Funnel({ result }: { result: SmartSearchResult }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const last = result.stages[result.stages.length - 1]?.left ?? result.matching;
  return (
    <View style={[styles.funnel, { backgroundColor: t.card, borderColor: t.border }]} accessibilityLiveRegion="polite">
      <Text style={[type.title, { color: t.text }]}>{s.smart.funnel(result.matching, last)}</Text>
      {result.stages.map((st) => (
        <View key={st.key} style={styles.stage}>
          <Text style={[type.caption, { color: t.textSub, flex: 1 }]}>{s.smart.stages[st.key] ?? st.key}</Text>
          <Text style={[type.caption, { color: st.removed ? t.danger : t.textMuted, fontWeight: '600' }]}>−{st.removed}</Text>
          <Text style={[type.caption, { color: t.text, width: 36, textAlign: 'right' }]}>{st.left}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.lg, paddingBottom: space.xxl * 2 },
  input: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  funnel: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  stage: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'space-between' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.xs },
  removed: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
