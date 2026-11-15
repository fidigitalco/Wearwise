import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Crown, ExternalLink, MapPin, Search, ShoppingBag, Star } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useToast } from '../components/Overlays';
import { Button, Chip, ChipWrap, FormScroll } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { errorMessage, finder, type FinderAllowance, type FinderPick, type FinderSearch } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';

const POLL_MS = 3000;

/**
 * "Find it for me": the person describes what they want and gets 10-12 real
 * products that fit their profile and deliver to their country. The search runs
 * on the server for about a minute; this screen polls it.
 */
export default function FindScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [allowance, setAllowance] = useState<FinderAllowance | null>(null);
  const [country, setCountry] = useState('');
  const [recent, setRecent] = useState<FinderSearch[]>([]);
  const [current, setCurrent] = useState<FinderSearch | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    finder.overview().then((o) => {
      setAllowance(o.allowance);
      setCountry(o.country);
      setRecent(o.recent);
      // Pick up where they left: a search still running, or the last result.
      setCurrent((cur) => cur ?? o.recent[0] ?? null);
    }).catch((e) => toast(errorMessage(e), 'error'));
  }, [toast]);

  useFocusEffect(load);

  // While a search runs, ask the server every few seconds how it is going.
  useEffect(() => {
    if (current?.status !== 'running') return;
    poll.current = setTimeout(() => {
      finder.get(current.id).then((next) => {
        setCurrent(next);
        if (next.status !== 'running') load();
      }).catch(() => setCurrent({ ...current }));  // a dropped request: try again on the next tick
    }, POLL_MS);
    return () => { if (poll.current) clearTimeout(poll.current); };
  }, [current, load]);

  const start = async () => {
    setBusy(true);
    try {
      const r = await finder.start(query.trim());
      setCurrent(r.search);
      setAllowance(r.allowance);
      setQuery('');
    } catch (e: any) {
      const d = e?.response?.data;
      if (d?.code === 'limit') setAllowance(d.allowance);
      else toast(d?.code === 'busy' ? s.finder.busy : d?.code === 'query_short' ? s.finder.queryShort : errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const running = current?.status === 'running';
  const outOfSearches = allowance !== null && allowance.remaining <= 0;
  const countryName = country ? (s.onb.countries[country] ?? country) : '';

  return (
    <FormScroll style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      <Text style={[type.body, { color: t.textSub }]}>{s.finder.intro}</Text>

      <View style={{ gap: space.sm }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={s.finder.placeholder}
          placeholderTextColor={t.textMuted}
          accessibilityLabel={s.finder.title}
          multiline
          maxLength={300}
          textAlignVertical="top"
          editable={!running}
          style={[type.body, styles.input, { color: t.text, backgroundColor: t.card, borderColor: t.border }]}
        />
        <ChipWrap>
          {s.finder.examples.map((x) => <Chip key={x} label={x} selected={false} onPress={() => setQuery(x)} />)}
        </ChipWrap>
      </View>

      <View style={styles.meta}>
        <MapPin size={14} color={t.textMuted} />
        <Text style={[type.caption, { color: t.textMuted, flex: 1 }]}>
          {countryName ? s.finder.deliverTo(countryName) : s.finder.noCountry}
        </Text>
      </View>

      {outOfSearches && !running ? (
        <Pressable onPress={() => router.push('/premium')} accessibilityRole="button"
          style={({ pressed }) => [styles.upsell, { backgroundColor: t.highlightBg, opacity: pressed ? 0.85 : 1 }]}>
          <Crown size={22} color={t.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.bodyStrong, { color: t.text }]}>{s.finder.limitTitle}</Text>
            <Text style={[type.caption, { color: t.textSub }]}>{s.finder.limitBody}</Text>
            <Text style={[type.caption, { color: t.primary, fontWeight: '600', marginTop: 2 }]}>{s.finder.limitCta}</Text>
          </View>
        </Pressable>
      ) : (
        <View style={{ gap: space.xs }}>
          <Button title={s.finder.find} onPress={start} loading={busy}
            disabled={running || query.trim().length < 3} />
          {allowance ? (
            <Text style={[type.caption, { color: t.textMuted, textAlign: 'center' }]}>
              {allowance.period === 'day' ? s.finder.leftDay(allowance.remaining) : s.finder.leftWeek(allowance.remaining)}
            </Text>
          ) : null}
        </View>
      )}

      {current ? <Result search={current} /> : null}

      {recent.filter((r) => r.id !== current?.id && r.status === 'done').length ? (
        <View style={{ gap: space.sm }}>
          <Text style={[type.overline, { color: t.textMuted }]}>{s.finder.recent}</Text>
          {recent.filter((r) => r.id !== current?.id && r.status === 'done').map((r) => (
            <Pressable key={r.id} onPress={() => setCurrent(r)} accessibilityRole="button"
              style={({ pressed }) => [styles.recent, { borderColor: t.border, backgroundColor: t.card, opacity: pressed ? 0.85 : 1 }]}>
              <Search size={16} color={t.textSub} />
              <Text style={[type.body, { color: t.text, flex: 1 }]} numberOfLines={1}>{r.query}</Text>
              <Text style={[type.caption, { color: t.textMuted }]}>{r.results.length}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </FormScroll>
  );
}

function Result({ search }: { search: FinderSearch }) {
  const t = useTheme();
  const { t: s } = useI18n();
  if (search.status === 'running') {
    return (
      <View style={[styles.state, { backgroundColor: t.card, borderColor: t.border }]} accessibilityLiveRegion="polite">
        <ActivityIndicator color={t.primary} />
        <Text style={[type.bodyStrong, { color: t.text, textAlign: 'center' }]}>{s.finder.searching}</Text>
        <Text style={[type.caption, { color: t.textSub, textAlign: 'center' }]}>{`“${search.query}”`}</Text>
        <Text style={[type.caption, { color: t.textMuted, textAlign: 'center' }]}>{s.finder.searchingSub}</Text>
      </View>
    );
  }
  if (search.status === 'failed') {
    return (
      <View style={[styles.state, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[type.body, { color: t.textSub, textAlign: 'center' }]}>
          {search.error.startsWith('Nothing suitable') ? s.finder.none : s.finder.failed}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: space.md }}>
      <Text style={[type.title, { color: t.text }]} numberOfLines={2}>{`“${search.query}”`}</Text>
      {search.note ? <Text style={[type.body, { color: t.textSub }]}>{search.note}</Text> : null}
      {search.results.map((p) => <PickCard key={p.url} pick={p} />)}
    </View>
  );
}

function PickCard({ pick }: { pick: FinderPick }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const [broken, setBroken] = useState(false);
  const price = pick.price != null ? `${pick.price} ${pick.currency}`.trim() : '';
  return (
    <Pressable onPress={() => Linking.openURL(pick.url).catch(() => {})} accessibilityRole="link" accessibilityLabel={`${pick.name}, ${pick.store}`}
      style={({ pressed }) => [styles.pick, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.9 : 1 }]}>
      {pick.image_url && !broken ? (
        <Image source={{ uri: pick.image_url }} style={[styles.photo, { backgroundColor: t.cardAlt }]} contentFit="cover" onError={() => setBroken(true)} />
      ) : (
        <View style={[styles.photo, styles.noPhoto, { backgroundColor: t.cardAlt }]}>
          <ShoppingBag size={28} color={t.textMuted} strokeWidth={1.4} />
        </View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[type.caption, { color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }]} numberOfLines={1}>{pick.store}</Text>
        <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={2}>{pick.name}</Text>
        <View style={styles.row}>
          {price ? <Text style={[type.bodyStrong, { color: t.text }]}>{price}</Text> : null}
          {pick.rating != null ? (
            <View style={styles.row}>
              <Star size={13} color={t.accent} fill={t.accent} />
              <Text style={[type.caption, { color: t.textSub }]}>
                {pick.rating.toFixed(1)}{pick.reviews != null ? ` ${s.finder.reviews(pick.reviews)}` : ''}
              </Text>
            </View>
          ) : null}
        </View>
        {pick.reason ? <Text style={[type.caption, { color: t.textSub }]} numberOfLines={3}>{pick.reason}</Text> : null}
        <View style={[styles.row, { marginTop: 2 }]}>
          <Text style={[type.caption, { color: t.primary, fontWeight: '600' }]}>{s.finder.open}</Text>
          <ExternalLink size={13} color={t.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.lg, paddingBottom: space.xxl * 2 },
  input: { minHeight: 96, borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  upsell: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  state: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.lg, borderWidth: 1 },
  pick: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  photo: { width: 96, height: 128, borderRadius: radius.md },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  recent: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
});
