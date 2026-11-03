import { router } from 'expo-router';
import { Bookmark, CalendarDays, ChevronRight, RefreshCw, Shirt, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { BottomSheet, useToast } from '../../components/Overlays';
import { OutfitCard, WeatherCard } from '../../components/Outfit';
import { Button, Chip, ChipRow, ChipWrap, EmptyState, IconButton, LoadingSkeleton } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useI18n, useLabel } from '../../lib/i18n';
import { useMeta } from '../../lib/meta';
import { readWeather, type WeatherInfo } from '../../lib/weather';
import { errorMessage, outfits as outfitsApi, type RecommendInput } from '../../services/api';
import { gutter, radius, space, type, useTheme } from '../../theme';
import type { Outfit, OutfitSet } from '../../types';

type Context = 'today' | 'work' | 'casual' | 'evening';
type WeatherFilter = 'any' | 'warm' | 'mild' | 'cold' | 'rainy';
type Filters = { occasion: string | null; style: string | null; weather: WeatherFilter; season: string | null };
const NO_FILTERS: Filters = { occasion: null, style: null, weather: 'any', season: null };

// A filter weather stands in for the forecast when the user wants to plan for other conditions.
const WEATHER: Record<Exclude<WeatherFilter, 'any'>, { temp_c: number; precip_prob: number }> = {
  warm: { temp_c: 26, precip_prob: 0 },
  mild: { temp_c: 17, precip_prob: 0.1 },
  cold: { temp_c: 4, precip_prob: 0.1 },
  rainy: { temp_c: 12, precip_prob: 0.85 },
};

/** A day in the middle of the season, so the engine dresses for it. */
function seasonDate(season: string): string {
  const y = new Date().getFullYear();
  const md = { spring: '04-15', summer: '07-15', autumn: '10-15', winter: '01-15' }[season] ?? '07-15';
  return `${y}-${md}`;
}

export default function OutfitsScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const meta = useMeta();
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const [wx, setWx] = useState<WeatherInfo | null>(null);
  const [context, setContext] = useState<Context>('today');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  // The last result and the request it answered; a different key means a new request is on its way.
  const [result, setResult] = useState<{ key: string; set: OutfitSet | null; notEnough: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean | null>>({});

  const occasion =
    filters.occasion ?? ({ today: user?.main_occasion || 'casual', work: 'work', casual: 'casual', evening: 'party' } as const)[context];

  const key = JSON.stringify({ occasion, filters });
  const loading = refreshing || result?.key !== key;
  const set = result?.set ?? null;
  const notEnough = result?.notEnough ?? false;

  const fetchSet = useCallback(
    async (fresh: boolean): Promise<{ set: OutfitSet | null; notEnough: boolean }> => {
      const filtered = filters.style || filters.weather !== 'any' || filters.season;
      try {
        let next = !fresh && !filtered ? await outfitsApi.latest(occasion) : null;
        if (!next) {
          const input: RecommendInput = { occasion };
          if (filters.style) input.style = filters.style;
          if (filters.weather !== 'any') Object.assign(input, WEATHER[filters.weather]);
          else if (wx) Object.assign(input, { temp_c: wx.temp_c, precip_prob: wx.precip_prob });
          if (filters.season) input.date = seasonDate(filters.season);
          next = await outfitsApi.recommend(input);
        }
        return { set: next, notEnough: false };
      } catch (e: any) {
        if (e?.response?.data?.code === 'not_enough_garments') return { set: null, notEnough: true };
        throw e;
      }
    },
    [occasion, filters, wx],
  );

  useEffect(() => {
    readWeather(user, updateUser).then(setWx);
    // Read once per visit; the user object changes when the location is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    fetchSet(false)
      .then((r) => {
        if (!alive) return;
        setResult({ key, ...r });
        setLiked({});
      })
      .catch((e) => {
        if (!alive) return;
        setResult({ key, set: null, notEnough: false });
        toast(errorMessage(e), 'error');
      });
    return () => {
      alive = false;
    };
  }, [fetchSet, key, toast]);

  const another = () => {
    setRefreshing(true);
    fetchSet(true)
      .then((r) => {
        setResult({ key, ...r });
        setLiked({});
      })
      .catch((e) => toast(errorMessage(e), 'error'))
      .finally(() => setRefreshing(false));
  };

  const react = (o: Outfit, value: boolean) => {
    const next = liked[o.id] === value ? null : value;
    setLiked((l) => ({ ...l, [o.id]: next }));
    if (next === null) return;
    outfitsApi.feedback({ outfit: o.id, liked: next, rank: o.position + 1 }).catch(() => {});
    if (next === false) toast(s.looks.disliked);
  };

  const toggleSave = async (o: Outfit) => {
    try {
      const updated = await outfitsApi.setSaved(o.id, !o.saved);
      setResult((r) => r && r.set && { ...r, set: { ...r.set, outfits: r.set.outfits.map((x) => (x.id === o.id ? updated : x)) } });
      toast(updated.saved ? s.looks.savedToast : s.looks.unsavedToast);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const filterCount = [filters.occasion, filters.style, filters.weather !== 'any' ? 1 : null, filters.season].filter(Boolean).length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <AppHeader
          title={s.looks.title}
          right={
            <>
              <IconButton icon={<CalendarDays size={22} color={t.text} />} label={s.calendar.open} onPress={() => router.push('/calendar')} />
              <IconButton icon={<Bookmark size={22} color={t.text} />} label={s.looks.saved} onPress={() => router.push('/saved')} />
              <IconButton icon={<SlidersHorizontal size={22} color={filterCount ? t.primary : t.text} />} label={s.looks.filters}
                onPress={() => setShowFilters(true)} active={filterCount > 0} />
            </>
          }
        />

        {wx && filters.weather === 'any' ? <WeatherCard info={wx} /> : null}

        <ChipRow>
          {(['today', 'work', 'casual', 'evening'] as Context[]).map((c) => (
            <Chip key={c} label={s.looks.contexts[c]} selected={!filters.occasion && context === c}
              onPress={() => { setContext(c); setFilters((f) => ({ ...f, occasion: null })); }} />
          ))}
        </ChipRow>

        {filterCount ? (
          <View style={styles.activeFilters}>
            {filters.occasion ? <Chip label={label('occasions', filters.occasion)} selected /> : null}
            {filters.style ? <Chip label={label('styles', filters.style)} selected /> : null}
            {filters.weather !== 'any' ? <Chip label={s.looks[filters.weather]} selected /> : null}
            {filters.season ? <Chip label={label('seasons', filters.season)} selected /> : null}
            <Pressable onPress={() => setFilters(NO_FILTERS)} hitSlop={8} accessibilityRole="button">
              <Text style={[type.label, { color: t.primary }]}>{s.wardrobe.reset}</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={{ gap: space.lg }}>
            {[0, 1].map((i) => <LoadingSkeleton key={i} height={380} radius={radius.lg} />)}
          </View>
        ) : notEnough ? (
          <EmptyState
            illustration={<Shirt size={44} color={t.textSecondary} strokeWidth={1.2} />}
            title={s.today.needClosetTitle}
            body={s.today.needClosetBody}
            action={<Button title={s.home.addClothing} onPress={() => router.push('/garment/new')} />}
          />
        ) : set && set.outfits.length ? (
          <View style={{ gap: space.xl }}>
            <Text style={[type.overline, { color: t.textMuted }]}>{s.looks.recommended}</Text>
            <OutfitCard
              outfit={set.outfits[0]}
              fallbackTitle={s.looks.fallbackTitle}
              liked={liked[set.outfits[0].id]}
              onLike={() => react(set.outfits[0], true)}
              onDislike={() => react(set.outfits[0], false)}
              onToggleSave={() => toggleSave(set.outfits[0])}
              onOpen={() => router.push({ pathname: '/outfit/[id]', params: { id: set.outfits[0].id } })}
            />
            {set.outfits.length > 1 ? (
              <View style={{ gap: space.md }}>
                <Text style={[type.overline, { color: t.textMuted }]}>{s.looks.alternatives}</Text>
                <View style={styles.alternatives}>
                  {set.outfits.slice(1, 3).map((o) => (
                    <View key={o.id} style={{ flex: 1 }}>
                      <OutfitCard variant="compact" outfit={o} fallbackTitle={s.looks.fallbackTitle}
                        onOpen={() => router.push({ pathname: '/outfit/[id]', params: { id: o.id } })} />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <Button title={s.looks.another} variant="secondary" onPress={another}
              icon={<RefreshCw size={18} color={t.text} strokeWidth={1.6} />} />
          </View>
        ) : (
          <EmptyState title={s.looks.empty} />
        )}

        <View style={[styles.links, { borderTopColor: t.border }]}>
          <LinkRow title={s.looks.check} hint={s.looks.checkHint} onPress={() => router.push('/outfit/check')} />
          <LinkRow title={s.home.askStylist} hint={s.assistant.emptyBody} onPress={() => router.push('/assistant')} />
        </View>
      </ScrollView>

      <BottomSheet visible={showFilters} onClose={() => setShowFilters(false)} title={s.looks.filters} closeLabel={s.common.close}>
        <Text style={[type.label, { color: t.textSub }]}>{s.looks.occasion}</Text>
        <ChipWrap>
          {Object.keys(meta.occasions).map((o) => (
            <Chip key={o} label={label('occasions', o)} selected={filters.occasion === o}
              onPress={() => setFilters((f) => ({ ...f, occasion: f.occasion === o ? null : o }))} />
          ))}
        </ChipWrap>
        <Text style={[type.label, { color: t.textSub }]}>{s.looks.style}</Text>
        <ChipWrap>
          {meta.style_directions.map((x) => (
            <Chip key={x} label={label('styles', x)} selected={filters.style === x}
              onPress={() => setFilters((f) => ({ ...f, style: f.style === x ? null : x }))} />
          ))}
        </ChipWrap>
        <Text style={[type.label, { color: t.textSub }]}>{s.looks.weather}</Text>
        <ChipWrap>
          {(['any', 'warm', 'mild', 'cold', 'rainy'] as WeatherFilter[]).map((w) => (
            <Chip key={w} label={s.looks[w]} selected={filters.weather === w} onPress={() => setFilters((f) => ({ ...f, weather: w }))} />
          ))}
        </ChipWrap>
        <Text style={[type.label, { color: t.textSub }]}>{s.looks.season}</Text>
        <ChipWrap>
          {meta.seasons.map((x) => (
            <Chip key={x} label={label('seasons', x)} selected={filters.season === x}
              onPress={() => setFilters((f) => ({ ...f, season: f.season === x ? null : x }))} />
          ))}
        </ChipWrap>
        <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
          <Button title={s.wardrobe.reset} variant="secondary" style={{ flex: 1 }} onPress={() => setFilters(NO_FILTERS)} />
          <Button title={s.wardrobe.apply} style={{ flex: 1 }} onPress={() => setShowFilters(false)} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function LinkRow({ title, hint, onPress }: { title: string; hint: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.link, { borderBottomColor: t.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: t.text }]}>{title}</Text>
        <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={2}>{hint}</Text>
      </View>
      <ChevronRight size={18} color={t.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingTop: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  alternatives: { flexDirection: 'row', gap: space.md },
  links: { borderTopWidth: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg, borderBottomWidth: 1 },
  activeFilters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
