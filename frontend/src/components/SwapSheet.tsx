import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorMessage, outfits as outfitsApi } from '../services/api';
import { useI18n, useLabel } from '../lib/i18n';
import { radius, space, useTheme } from '../theme';
import type { Garment, Outfit } from '../types';
import { GarmentThumb } from './GarmentThumb';
import { Button, CompatibilityScore } from './ui';

type Option = { garment: Garment; total: number };

/**
 * Bottom sheet to swap one piece of a suggested look. Lists the other pieces of
 * the same kind with the score the look would get, best first; picking one
 * re-scores the look on the server and counts as feedback.
 */
export function SwapSheet({
  outfit, slot, onClose, onSwapped,
}: { outfit: Outfit | null; slot: string | null; onClose: () => void; onSwapped: (o: Outfit) => void }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const [options, setOptions] = useState<Option[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const visible = !!outfit && !!slot;
  const current = outfit?.items.find((i) => i.slot === slot)?.garment;

  useEffect(() => {
    if (!outfit || !slot) return;
    let alive = true;
    outfitsApi
      .alternatives(outfit.id, slot)
      .then((r) => alive && setOptions(r.options))
      .catch(() => alive && setOptions([]));
    return () => {
      alive = false;
      setOptions(null);
    };
  }, [outfit, slot]);

  const pick = async (g: Garment) => {
    if (!outfit || !slot) return;
    setBusy(g.id);
    try {
      onSwapped(await outfitsApi.swap(outfit.id, slot, g.id));
      onClose();
    } catch (e) {
      Alert.alert(s.swap.couldNotSwap, errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const kind = current ? label('categories', current.category) : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: t.overlay }]} onPress={onClose} accessibilityLabel={s.swap.close} />
      <View style={[styles.sheet, { backgroundColor: t.card }]}>
        <View style={[styles.handle, { backgroundColor: t.border }]} />
        <Text style={[styles.title, { color: t.text }]}>{s.swap.title(kind)}</Text>

        {current ? (
          <View style={styles.row}>
            <GarmentThumb garment={current} size={64} showLabel={false} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.textMuted, fontSize: 12 }}>{s.swap.current}</Text>
              <Text style={{ color: t.text, fontWeight: '600' }} numberOfLines={1}>
                {current.name || label('subcategories', current.subcategory)}
              </Text>
            </View>
            <CompatibilityScore value={outfit?.total_score ?? 0} />
          </View>
        ) : null}

        {options === null ? (
          <ActivityIndicator style={{ marginVertical: space.xl }} color={t.textMuted} />
        ) : options.length === 0 ? (
          <Text style={{ color: t.textSub, marginVertical: space.lg }}>{s.swap.none}</Text>
        ) : (
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: space.sm }}>
            {options.map((o) => (
              <Pressable
                key={o.garment.id}
                onPress={() => pick(o.garment)}
                disabled={!!busy}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, styles.option, { borderColor: t.border }, pressed && { backgroundColor: t.cardAlt }]}
              >
                <GarmentThumb garment={o.garment} size={64} showLabel={false} />
                <Text style={{ color: t.text, flex: 1, fontWeight: '500' }} numberOfLines={2}>
                  {o.garment.name || label('subcategories', o.garment.subcategory)}
                </Text>
                {busy === o.garment.id ? <ActivityIndicator color={t.textMuted} /> : <CompatibilityScore value={o.total} />}
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Button title={s.swap.close} variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, paddingBottom: space.xxl, gap: space.md,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  title: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  option: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.sm },
});
