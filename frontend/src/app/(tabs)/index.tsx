import { router, useFocusEffect } from 'expo-router';
import { CalendarDays, Search, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Hanger } from '../../components/icons';
import { GuestBanner } from '../../components/GuestBanner';
import { useToast } from '../../components/Overlays';
import { DayPlan } from '../../components/DayPlan';
import { ShoppingRow } from '../../components/Shopping';
import { TomorrowCard } from '../../components/Tomorrow';
import { OutfitHeroCard, WeatherLine } from '../../components/Outfit';
import { Button, EmptyState, IconButton, LoadingSkeleton, SectionHeader } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { readWeather, type WeatherInfo } from '../../lib/weather';
import { calendar, errorMessage, garments as garmentsApi, getShopping, getStats, outfits as outfitsApi } from '../../services/api';
import { gutter, radius, space, type, useTheme } from '../../theme';
import type { Outfit, OutfitSet, ShoppingSuggestion, Stats } from '../../types';

/** `plan` is the outfit picked ahead for today, shown instead of the suggestion. */
type HomeData = { stats: Stats | null; weather: WeatherInfo | null; set: OutfitSet | null; notEnough: boolean; plan: Outfit | null };

/** YYYY-MM-DD in local time. */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const t = useTheme();
  const { t: s, lang } = useI18n();
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [set, setSet] = useState<OutfitSet | null>(null);
  const [plan, setPlan] = useState<Outfit | null>(null);
  const [loading, setLoading] = useState(true);
  const [another, setAnother] = useState(false);
  const [notEnough, setNotEnough] = useState(false);
  const [worn, setWorn] = useState<string | null>(null);
  const [shop, setShop] = useState<ShoppingSuggestion[]>([]);
  // The day's plan can pick another occasion than the usual one, for today only.
  const [dayOccasion, setDayOccasion] = useState<string | null>(null);
  const occasion = dayOccasion || user?.main_occasion || 'casual';

  // Fetchers only fetch and return; state is set from their results (react-hooks/set-state-in-effect).
  const fetchSuggestions = useCallback(
    async (fresh: boolean, wx: WeatherInfo | null): Promise<Pick<HomeData, 'set' | 'notEnough'>> => {
      try {
        const latest = fresh ? null : await outfitsApi.latest(occasion);
        const set =
          latest ?? (await outfitsApi.recommend({ occasion, temp_c: wx?.temp_c ?? null, precip_prob: wx?.precip_prob ?? null }));
        return { set, notEnough: false };
      } catch (e: any) {
        if (e?.response?.data?.code === 'not_enough_garments') return { set: null, notEnough: true };
        throw e;
      }
    },
    [occasion],
  );

  const fetchHome = useCallback(async (): Promise<HomeData> => {
    const [st, wx, today] = await Promise.all([
      getStats().catch(() => null),
      readWeather(user, updateUser),
      calendar.day(isoDate(new Date())).catch(() => null),
    ]);
    const suggestion = st && st.total > 0 ? await fetchSuggestions(false, wx).catch(() => ({ set: null, notEnough: false })) : { set: null, notEnough: false };
    return { stats: st, weather: wx, ...suggestion, plan: today?.plan ?? null };
    // The user object changes when the location is saved; refetching then would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSuggestions]);

  const apply = (d: HomeData) => {
    setStats(d.stats);
    setWeather(d.weather);
    setSet(d.set);
    setPlan(d.plan);
    setNotEnough(d.notEnough);
    setLoading(false);
  };

  const load = () => fetchHome().then(apply);

  useEffect(() => {
    fetchHome().then(apply);
  }, [fetchHome]);

  // Counts change when clothes are added elsewhere; keep the summary fresh.
  useFocusEffect(
    useCallback(() => {
      getStats().then(setStats).catch(() => {});
      getShopping().then(setShop).catch(() => {});
    }, []),
  );

  const tryAnother = () => {
    setAnother(true);
    fetchSuggestions(true, weather)
      .then((r) => {
        setSet(r.set);
        setNotEnough(r.notEnough);
      })
      .catch((e) => toast(errorMessage(e), 'error'))
      .finally(() => setAnother(false));
  };

  const replaceOutfit = (o: Outfit) => {
    setSet((cur) => cur && { ...cur, outfits: cur.outfits.map((x) => (x.id === o.id ? o : x)) });
    setPlan((cur) => (cur?.id === o.id ? o : cur));
  };

  const toggleSave = async (o: Outfit) => {
    try {
      const updated = await outfitsApi.setSaved(o.id, !o.saved);
      replaceOutfit(updated);
      toast(updated.saved ? s.looks.savedToast : s.looks.unsavedToast);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const wear = async (o: Outfit) => {
    try {
      await outfitsApi.wear(o.id);
      setWorn(o.id);
      toast(s.home.wornToast);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const loadSample = async () => {
    try {
      await garmentsApi.loadSample();
      toast(s.home.sampleLoaded);
      setLoading(true);
      apply(await fetchHome());
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? s.home.morning : hour < 18 ? s.home.afternoon : s.home.evening;
  const date = new Date().toLocaleDateString(lang === 'az' ? 'az-AZ' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const empty = stats !== null && stats.total === 0;
  const look = plan ?? set?.outfits[0];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={styles.wrap}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.textSecondary} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.caption, { color: t.textMuted, textTransform: 'capitalize' }]}>{date}</Text>
            <Text style={[type.display, { color: t.text }]}>
              {greeting}
              {user?.display_name ? `, ${user.display_name.split(' ')[0]}` : ''}
            </Text>
            {weather ? <WeatherLine info={weather} /> : null}
          </View>
          <IconButton icon={<CalendarDays size={22} color={t.text} strokeWidth={1.6} />} label={s.calendar.open} onPress={() => router.push('/calendar')} />
          <IconButton icon={<Search size={22} color={t.text} strokeWidth={1.6} />} label={s.search.title} onPress={() => router.push('/search')} />
          <IconButton icon={<Sparkles size={22} color={t.text} strokeWidth={1.6} />} label={s.home.askStylist} onPress={() => router.push('/assistant')} />
        </View>

        <GuestBanner />

        {loading ? (
          <View style={{ gap: space.md }}>
            <LoadingSkeleton height={380} radius={radius.lg} />
            <LoadingSkeleton height={22} width="55%" />
            <LoadingSkeleton height={16} width="80%" />
          </View>
        ) : empty ? (
          <EmptyState
            illustration={<Hanger size={48} color={t.textSecondary} strokeWidth={1.2} />}
            title={s.home.emptyTitle}
            body={s.home.emptyBody}
            action={
              <View style={{ gap: space.sm, alignSelf: 'stretch' }}>
                <Button title={s.wardrobe.emptyAction} onPress={() => router.push('/garment/new')} />
                <Button title={s.home.sample} variant="ghost" onPress={loadSample} />
              </View>
            }
          />
        ) : notEnough ? (
          <EmptyState
            title={s.today.needClosetTitle}
            body={s.today.needClosetBody}
            action={<Button title={s.home.addClothing} onPress={() => router.push('/garment/new')} />}
          />
        ) : look ? (
          <View style={{ gap: space.md }}>
            {plan ? null : <DayPlan occasion={occasion} onOccasion={setDayOccasion} inset={gutter} />}
            <Text style={[type.overline, { color: t.accent }]}>{plan ? s.home.plannedLook : s.home.todayLook}</Text>
            <OutfitHeroCard
              outfit={look}
              fallbackTitle={s.looks.fallbackTitle}
              onOpen={() => router.push({ pathname: '/outfit/[id]', params: { id: look.id } })}
              onAnother={plan ? undefined : tryAnother}
              loadingAnother={another}
              onToggleSave={() => toggleSave(look)}
              onWear={() => wear(look)}
              worn={worn === look.id}
            />
          </View>
        ) : null}

        {!empty && !notEnough && !loading ? <TomorrowCard /> : null}

        {shop.length && !empty && !loading ? (
          <View style={{ gap: space.md }}>
            <View style={{ gap: 2 }}>
              <SectionHeader title={s.shop.title} action={s.home.seeAll} onAction={() => router.push('/shop')} />
              <Text style={[type.caption, { color: t.textMuted }]}>{s.shop.hint}</Text>
            </View>
            <ShoppingRow items={shop} inset={gutter} />
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingTop: space.lg, gap: space.xxl, paddingBottom: space.xxl * 2 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 0 },
});
