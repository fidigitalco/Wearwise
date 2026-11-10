import { useFocusEffect } from 'expo-router';
import { CalendarDays, Check, Layers, Shirt, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { GarmentImage } from '../../components/Garment';
import { isoDay, longDate, MonthPicker } from '../../components/MonthPicker';
import { OutfitCollage } from '../../components/Outfit';
import { BottomSheet, useToast } from '../../components/Overlays';
import { LookCard, ShopSheet } from '../../components/Products';
import { Button, Chip, ChipWrap, Field, FormScroll, LoadingSkeleton, SectionHeader } from '../../components/ui';
import { LOCALES, useI18n, useLabel } from '../../lib/i18n';
import { errorMessage, garments as garmentsApi, occasions as api, outfits as outfitsApi } from '../../services/api';
import { radius, space, type, useTheme, gutter } from '../../theme';
import type { Garment, Look, OccasionItem, Outfit, Product } from '../../types';

const KINDS = ['birthday', 'wedding', 'holiday', 'work', 'trip', 'date', 'other'] as const;

// One piece per kind when building an outfit from the closet.
const BUILD_ORDER = ['outerwear', 'top', 'dress', 'bottom', 'shoes', 'bag', 'accessory'];

/**
 * Dates (MVP v2 §4): birthdays, weddings, holidays and trips, counted down.
 * Outfits come 15 days before (an early preview until then); gift mode gives
 * ideas for someone else's date.
 */
export default function DatesScreen() {
  const t = useTheme();
  const { t: s, lang } = useI18n();
  const label = useLabel();
  const toast = useToast();
  const locale = LOCALES[lang];
  const [list, setList] = useState<OccasionItem[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [looks, setLooks] = useState<Look[] | null>(null);
  const [shop, setShop] = useState<Product[] | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<string>(() => isoDay(new Date(Date.now() + 14 * 86400000)));
  const [picking, setPicking] = useState(false);
  const [sheet, setSheet] = useState<'outfits' | 'closet' | null>(null);
  const [saved, setSaved] = useState<Outfit[] | null>(null);
  const [closet, setCloset] = useState<Garment[] | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>('birthday');
  const [gift, setGift] = useState(false);
  const [person, setPerson] = useState('');
  const [adding, setAdding] = useState(false);

  const open = (id: number) => {
    setOpenId(id);
    setLooks(null);
    api.get(id).then((d) => {
      setLooks(d.looks);
      setList((l) => l?.map((x) => (x.id === id ? { ...x, outfit: d.outfit } : x)) ?? l);
    }).catch(() => setLooks([]));
  };

  const wear = (outfitId: string | null) => {
    if (openId === null) return;
    setBusy(true);
    api.setOutfit(openId, outfitId)
      .then((d) => {
        setList((l) => l?.map((x) => (x.id === d.id ? { ...x, outfit: d.outfit } : x)) ?? l);
        setSheet(null);
        if (outfitId) toast(s.dates.outfitSet);
      })
      .catch((e) => toast(errorMessage(e), 'error'))
      .finally(() => setBusy(false));
  };

  const openSheet = (which: 'outfits' | 'closet') => {
    setSheet(which);
    if (which === 'outfits' && saved === null) outfitsApi.list({ saved: true }).then(setSaved).catch(() => setSaved([]));
    if (which === 'closet') {
      setChosen({});
      if (closet === null) garmentsApi.list({ status: 'available' }).then(setCloset).catch(() => setCloset([]));
    }
  };

  // Build from the closet: the picked pieces are scored and saved as an outfit, then worn on the date.
  const buildAndWear = () => {
    const ids = Object.values(chosen);
    if (!ids.length) return;
    setBusy(true);
    outfitsApi.check({ garment_ids: ids, occasion: 'casual', save: true })
      .then((r) => {
        const id = r.outfit?.id;
        if (id) wear(id);
        else setBusy(false);
      })
      .catch((e) => {
        toast(errorMessage(e), 'error');
        setBusy(false);
      });
  };

  const pickPiece = (g: Garment) => {
    // A dress replaces top and bottom, and the other way round.
    setChosen((c) => {
      const next = { ...c };
      if (next[g.category] === g.id) {
        delete next[g.category];
        return next;
      }
      if (g.category === 'dress') { delete next.top; delete next.bottom; }
      if (g.category === 'top' || g.category === 'bottom') delete next.dress;
      next[g.category] = g.id;
      return next;
    });
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
    if (!title.trim() || !date) return;
    setAdding(true);
    api.add({ title: title.trim(), date, kind, for_gift: gift, person: gift ? person.trim() : '' })
      .then((o) => {
        toast(s.dates.added);
        setTitle('');
        setPerson('');
        setPicking(false);
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
                    <Text style={[type.caption, { color: t.textSub, textTransform: 'capitalize' }]} numberOfLines={1}>{longDate(o.date, locale)}</Text>
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

        {current && !current.for_gift ? (
          <View style={{ gap: space.md }}>
            <SectionHeader title={s.dates.myOutfit} />
            {current.outfit ? (
              <View style={[styles.mine, { backgroundColor: t.card }]}>
                <OutfitCollage outfit={current.outfit} style={styles.mineCollage} gap={4} />
                <View style={{ flex: 1, gap: space.sm }}>
                  <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={2}>{current.outfit.title || s.looks.fallbackTitle}</Text>
                  <Button title={s.dates.removeOutfit} variant="ghost" size="sm" onPress={() => wear(null)} loading={busy} />
                </View>
              </View>
            ) : null}
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Button title={s.dates.fromOutfits} variant="secondary" size="sm" icon={<Layers size={16} color={t.text} />} onPress={() => openSheet('outfits')} /></View>
              <View style={{ flex: 1 }}><Button title={s.dates.fromCloset} variant="secondary" size="sm" icon={<Shirt size={16} color={t.text} />} onPress={() => openSheet('closet')} /></View>
            </View>
          </View>
        ) : null}

        {current ? (
          <View style={{ gap: space.md }}>
            <SectionHeader title={current.for_gift ? s.dates.giftsFor(current.person || current.title) : `${s.dates.fromStore} · ${s.dates.outfitsFor(current.title)}`} />
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
          <Pressable onPress={() => setPicking((v) => !v)} accessibilityRole="button" accessibilityLabel={s.dates.when}
            style={({ pressed }) => [styles.dateRow, { borderColor: t.border, backgroundColor: pressed ? t.cardAlt : t.card }]}>
            <CalendarDays size={18} color={t.primary} />
            <Text style={[type.body, { color: t.text, flex: 1, textTransform: 'capitalize' }]}>{longDate(date, locale)}</Text>
            <Text style={{ color: t.highlight, fontWeight: '600' }}>{s.common.change}</Text>
          </Pressable>
          {picking ? <MonthPicker value={date} onChange={(d) => { setDate(d); setPicking(false); }} /> : null}
          <Button title={s.dates.add} onPress={add} loading={adding} disabled={!title.trim() || !date} />
          <Text style={[type.caption, { color: t.textMuted }]}>{s.dates.giftLimit}</Text>
        </View>
      </FormScroll>
      <ShopSheet products={shop} onClose={() => setShop(null)} />

      <BottomSheet visible={sheet === 'outfits'} onClose={() => setSheet(null)} title={s.dates.fromOutfits} closeLabel={s.common.close}>
        {saved === null ? <LoadingSkeleton height={120} radius={radius.lg} /> : saved.length === 0 ? (
          <Text style={[type.body, { color: t.textMuted }]}>{s.dates.noSaved}</Text>
        ) : (
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: space.sm }}>
            {saved.map((o) => (
              <Pressable key={o.id} onPress={() => wear(o.id)} disabled={busy} accessibilityRole="button"
                style={({ pressed }) => [styles.pickRow, { borderColor: t.border, backgroundColor: pressed ? t.cardAlt : t.card }]}>
                <OutfitCollage outfit={o} style={styles.pickCollage} gap={2} />
                <Text style={[type.bodyStrong, { color: t.text, flex: 1 }]} numberOfLines={2}>{o.title || s.looks.fallbackTitle}</Text>
                {current?.outfit?.id === o.id ? <Check size={18} color={t.primary} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </BottomSheet>

      <BottomSheet visible={sheet === 'closet'} onClose={() => setSheet(null)} title={s.dates.fromCloset} closeLabel={s.common.close}>
        {closet === null ? <LoadingSkeleton height={160} radius={radius.lg} /> : closet.length === 0 ? (
          <Text style={[type.body, { color: t.textMuted }]}>{s.dates.emptyCloset}</Text>
        ) : (
          <>
            <Text style={[type.caption, { color: t.textMuted }]}>{s.dates.pickPieces}</Text>
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: space.md }}>
              {BUILD_ORDER.map((cat) => {
                const pieces = closet.filter((g) => g.category === cat);
                if (!pieces.length) return null;
                return (
                  <View key={cat} style={{ gap: space.xs }}>
                    <Text style={[type.overline, { color: t.textMuted }]}>{label('categories', cat)}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                      {pieces.map((g) => {
                        const on = chosen[cat] === g.id;
                        return (
                          <Pressable key={g.id} onPress={() => pickPiece(g)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                            accessibilityLabel={g.name || label('subcategories', g.subcategory)}
                            style={[styles.piece, { borderColor: on ? t.primary : t.border, borderWidth: on ? 2 : 1 }]}>
                            <GarmentImage garment={g} style={{ width: '100%', height: '100%' }} />
                            {on ? <View style={[styles.pieceCheck, { backgroundColor: t.primary }]}><Check size={12} color={t.onPrimary} /></View> : null}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              })}
            </ScrollView>
            <Button title={s.dates.useThis} onPress={buildAndWear} loading={busy} disabled={!Object.keys(chosen).length} />
          </>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingTop: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg },
  daysBox: { width: 54, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  form: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', gap: space.sm },
  mine: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 22 },
  mineCollage: { width: 96, aspectRatio: 0.9, borderRadius: radius.md, overflow: 'hidden' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.md, borderWidth: 1 },
  pickCollage: { width: 56, aspectRatio: 0.9, borderRadius: radius.sm, overflow: 'hidden' },
  piece: { width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden' },
  pieceCheck: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
