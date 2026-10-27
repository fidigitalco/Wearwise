import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GarmentThumb } from '../../components/GarmentThumb';
import { Body, Button, Card, Chip, ChipRow, Label, ScoreBar } from '../../components/ui';
import { errorMessage, garments as garmentsApi, outfits as outfitsApi, type CheckResult } from '../../lib/api';
import { CATEGORY_ORDER, humanize, useMeta } from '../../lib/meta';
import { space, useTheme } from '../../lib/theme';
import type { Category, Garment, ScoreKey } from '../../lib/types';

const SCORE_LABELS: [ScoreKey, string][] = [
  ['color', 'Colour'], ['occasion', 'Occasion'], ['weather', 'Weather'],
  ['silhouette', 'Silhouette'], ['material', 'Material'], ['taste', 'Your taste'],
];

/** Pick one piece per slot, choose the occasion, and get a score with the reason. */
export default function CheckOutfitScreen() {
  const t = useTheme();
  const meta = useMeta();
  const [closet, setCloset] = useState<Garment[] | null>(null);
  const [picked, setPicked] = useState<Partial<Record<Category, string>>>({});
  const [occasion, setOccasion] = useState('casual');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    garmentsApi.list({ status: 'available' }).then(setCloset).catch(() => setCloset([]));
  }, []);

  const byCat = useMemo(() => {
    const m: Partial<Record<Category, Garment[]>> = {};
    for (const g of closet ?? []) (m[g.category] ??= []).push(g);
    return m;
  }, [closet]);

  const toggle = (g: Garment) => {
    setResult(null);
    setPicked((p) => {
      const next = { ...p };
      if (next[g.category] === g.id) delete next[g.category];
      else {
        next[g.category] = g.id;
        // A dress replaces top + bottom, and the other way round.
        if (g.category === 'dress') {
          delete next.top;
          delete next.bottom;
        } else if (g.category === 'top' || g.category === 'bottom') delete next.dress;
      }
      return next;
    });
  };

  const ids = Object.values(picked).filter(Boolean) as string[];

  const check = async (save = false) => {
    setBusy(true);
    try {
      const r = await outfitsApi.check({ garment_ids: ids, occasion, save });
      setResult(r);
      if (save) {
        Alert.alert('Saved', 'You will find it under Outfits.');
        router.back();
      }
    } catch (e) {
      Alert.alert('Could not check', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!closet) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.text} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={{ gap: space.sm }}>
        <Label>Occasion</Label>
        <ChipRow>
          {Object.keys(meta.occasions).map((o) => (
            <Chip key={o} label={humanize(o)} selected={o === occasion} onPress={() => { setOccasion(o); setResult(null); }} />
          ))}
        </ChipRow>
      </View>

      {CATEGORY_ORDER.filter((c) => byCat[c]?.length).map((c) => (
        <View key={c} style={{ gap: space.sm }}>
          <Label>{humanize(c)}</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {byCat[c]!.map((g) => (
              <GarmentThumb key={g.id} garment={g} size={84} selected={picked[c] === g.id} onPress={() => toggle(g)} />
            ))}
          </ScrollView>
        </View>
      ))}

      {closet.length === 0 ? <Body muted>Add pieces to your closet first.</Body> : null}

      <Button title="Will it work?" onPress={() => check(false)} loading={busy && !result} disabled={ids.length < 2} />

      {result ? (
        <Card>
          <View style={styles.header}>
            <Text style={[styles.verdict, { color: t.text }]}>
              {result.scores.total >= 78 ? 'Yes, it works' : result.scores.total >= 65 ? 'It can work' : 'Worth rethinking'}
            </Text>
            <Text style={[styles.total, { color: t.highlight }]}>{Math.round(result.scores.total)}</Text>
          </View>
          <Body>{result.explanation}</Body>
          <View style={{ gap: 6 }}>
            {SCORE_LABELS.map(([k, label]) => (
              <ScoreBar key={k} label={label} value={result.scores[k]} />
            ))}
          </View>
          <Button title="Save this outfit" variant="secondary" onPress={() => check(true)} loading={busy} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verdict: { fontSize: 18, fontWeight: '700' },
  total: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
