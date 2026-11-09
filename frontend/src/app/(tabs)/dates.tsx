import { useFocusEffect } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { useToast } from '../../components/Overlays';
import { LookCard, ShopSheet } from '../../components/Products';
import { Button, Chip, ChipWrap, Field, FormScroll, LoadingSkeleton, SectionHeader } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { errorMessage, occasions as api } from '../../services/api';
import { radius, space, type, useTheme, gutter } from '../../theme';
import type { Look, OccasionItem, Product } from '../../types';

const KINDS = ['birthday', 'wedding', 'holiday', 'work', 'trip', 'date', 'other'] as const;

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Dates (MVP v2 §4): birthdays, weddings, holidays and trips, counted down.
 * Outfits come 15 days before (an early preview until then); gift mode gives
 * ideas for someone else's date.
 */
export default function DatesScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const [list, setList] = useState<OccasionItem[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [looks, setLooks] = useState<Look[] | null>(null);
  const [shop, setShop] = useState<Product[] | null>(null);
  const [title, setTitle] = useState('');
  const [days, setDays] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]>('birthday');
  const [gift, setGift] = useState(false);
  const [person, setPerson] = useState('');
  const [adding, setAdding] = useState(false);

  const open = (id: number) => {
    setOpenId(id);
    setLooks(null);
    api.get(id).then((d) => setLooks(d.looks)).catch(() => setLooks([]));
  };

  const load = useCallback(() => {
    api.list()
      .then((rows) => {
        setList(rows);
        if (rows.length) open(rows[0].id);
      })
      .catch(() => setList([]));
  }, []);

  useFocusEffect(load);

  const add = () => {
    const n = parseInt(days, 10);
    if (!title.trim() || !Number.isFinite(n) || n < 0) return;
    setAdding(true);
    api.add({ title: title.trim(), date: inDays(n), kind, for_gift: gift, person: gift ? person.trim() : '' })
      .then((o) => {
        toast(s.dates.added);
        setTitle('');
        setDays('');
        setPerson('');
        setList((l) => [...(l ?? []), o].sort((a, b) => a.days - b.days));
        open(o.id);
      })
      .catch((e) => toast(e?.response?.data?.code === 'gift_limit' ? s.dates.giftLimit : errorMessage(e), 'error'))
      .finally(() => setAdding(false));
  };

  const remove = (o: OccasionItem) =>
    api.remove(o.id).then(() => {
      setList((l) => l?.filter((x) => x.id !== o.id) ?? null);
      if (openId === o.id) {
        setOpenId(null);
        setLooks(null);
      }
    }).catch((e) => toast(errorMessage(e), 'error'));

  const current = list?.find((o) => o.id === openId);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <FormScroll contentContainerStyle={styles.wrap}>
        <AppHeader title={s.dates.title} />
        <Text style={[type.body, { color: t.textSub, marginTop: -space.md }]}>{s.dates.sub}</Text>

        {list === null ? <LoadingSkeleton height={140} radius={radius.lg} /> : list.length === 0 ? (
          <Text style={[type.body, { color: t.textMuted }]}>{s.dates.empty}</Text>
        ) : (
          <View style={{ gap: space.sm }}>
            {list.map((o) => {
              const on = o.id === openId;
              return (
                <Pressable key={o.id} onPress={() => open(o.id)} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.item, { backgroundColor: t.card, borderColor: on ? t.primary : t.border, borderWidth: on ? 2 : 1, opacity: pressed ? 0.85 : 1 }]}>
                  <View style={[styles.daysBox, { backgroundColor: t.cardAlt }]}>
                    <Text style={[type.title, { color: t.text }]}>{o.days}</Text>
                    <Text style={[type.caption, { color: t.textMuted, fontSize: 10 }]}>{s.dates.days(o.days).replace(/^\d+\s*/, '')}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{o.title}</Text>
                    <Text style={[type.caption, { color: t.textMuted }]}>
                      {s.dates.kinds[o.kind]}{o.for_gift ? ` · ${s.dates.forGift}${o.person ? `: ${o.person}` : ''}` : ''}
                    </Text>
                  </View>
                  {o.ready ? (
                    <View style={[styles.pill, { backgroundColor: t.highlightBg }]}><Text style={[type.caption, { color: t.primary, fontWeight: '700' }]}>{s.dates.ready}</Text></View>
                  ) : null}
                  <Pressable onPress={() => remove(o)} hitSlop={8} accessibilityRole="button" accessibilityLabel={s.dates.remove}>
                    <Trash2 size={16} color={t.textMuted} />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        )}

        {current ? (
          <View style={{ gap: space.md }}>
            <SectionHeader title={current.for_gift ? s.dates.giftsFor(current.person || current.title) : s.dates.outfitsFor(current.title)} />
            {!current.ready ? <Text style={[type.caption, { color: t.textMuted }]}>{s.dates.preview(current.days - 15)}</Text> : null}
            {looks === null ? <LoadingSkeleton height={240} radius={radius.lg} /> : looks.map((l, i) => (
              <LookCard key={i} look={l} title={l.items.length === 1 ? l.items[0].name : `${s.dates.kinds[current.kind]} ${i + 1}`} onShop={() => setShop(l.items)} />
            ))}
          </View>
        ) : null}

        <View style={[styles.form, { backgroundColor: t.card, borderColor: t.border }]}>
          <SectionHeader title={s.dates.add} />
          <Field value={title} onChangeText={setTitle} placeholder={s.dates.titlePlaceholder} maxLength={80} />
          <ChipWrap>
            {KINDS.map((k) => <Chip key={k} label={s.dates.kinds[k]} selected={kind === k} onPress={() => setKind(k)} />)}
          </ChipWrap>
          <ChipWrap>
            <Chip label={s.dates.forMe} selected={!gift} onPress={() => setGift(false)} />
            <Chip label={s.dates.forGift} selected={gift} onPress={() => setGift(true)} />
          </ChipWrap>
          {gift ? <Field value={person} onChangeText={setPerson} placeholder={s.dates.person} maxLength={60} /> : null}
          <Field value={days} onChangeText={(v) => setDays(v.replace(/[^0-9]/g, ''))} placeholder={s.dates.inDays} keyboardType="number-pad" maxLength={3} />
          <Button title={s.dates.add} onPress={add} loading={adding} disabled={!title.trim() || !days} />
          <Text style={[type.caption, { color: t.textMuted }]}>{s.dates.giftLimit}</Text>
        </View>
      </FormScroll>
      <ShopSheet products={shop} onClose={() => setShop(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingTop: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg },
  daysBox: { width: 54, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  form: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
});
