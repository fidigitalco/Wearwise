import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useToast } from '../components/Overlays';
import { Chip, ChipWrap, FormScroll } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { errorMessage, purchases as api, type Purchase } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';

const FITS = ['perfect', 'too_small', 'too_big', 'returned'] as const;

/** My purchases (build prompt §2.8): "How did it fit?" teaches the size that fits in each brand. */
export default function PurchasesScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const [list, setList] = useState<Purchase[]>([]);
  const [sizes, setSizes] = useState<{ brand: string; kind: string; size: string }[]>([]);

  const load = useCallback(() => {
    api.list().then((r) => { setList(r.purchases); setSizes(r.brand_sizes); }).catch((e) => toast(errorMessage(e), 'error'));
  }, [toast]);
  useFocusEffect(load);

  const answer = async (p: Purchase, fit: (typeof FITS)[number]) => {
    try {
      const r = await api.fit(p.id, fit);
      if (r.brand_size) toast(s.buy.learned(r.brand_size.brand, r.brand_size.size));
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <FormScroll style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      {list.map((p) => (
        <View key={p.id} style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={2}>{p.name || p.brand}</Text>
          <Text style={[type.caption, { color: t.textMuted }]}>{p.brand} · {p.size}</Text>
          <Text style={[type.label, { color: t.textSub }]}>{s.buy.fitTitle}</Text>
          <ChipWrap>
            {FITS.map((f) => <Chip key={f} label={s.buy[f]} selected={p.fit === f} onPress={() => answer(p, f)} />)}
          </ChipWrap>
        </View>
      ))}
      {sizes.length ? (
        <View style={{ gap: space.xs }}>
          <Text style={[type.overline, { color: t.textMuted }]}>{s.buy.fitCheck}</Text>
          {sizes.map((b) => (
            <Text key={`${b.brand}-${b.kind}`} style={[type.body, { color: t.text }]}>{b.brand} · {b.kind} · {b.size}</Text>
          ))}
        </View>
      ) : null}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.lg, paddingBottom: space.xxl * 2 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
});
