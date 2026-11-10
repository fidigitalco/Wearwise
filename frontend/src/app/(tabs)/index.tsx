import { router, useFocusEffect } from 'expo-router';
import { CalendarHeart, ChevronRight, TrendingDown } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GuestBanner } from '../../components/GuestBanner';
import { WeatherLine } from '../../components/Outfit';
import { LookCard, money, ProductTile, ShopSheet } from '../../components/Products';
import { LoadingSkeleton, SectionHeader } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { LOCALES, useI18n } from '../../lib/i18n';
import { readWeather, type WeatherInfo } from '../../lib/weather';
import { catalog } from '../../services/api';
import { elevation, gutter, radius, space, type, useTheme } from '../../theme';
import type { HomeFeed, Product } from '../../types';

/**
 * Home (MVP v2): the day's look from the catalogue, picks for the user's
 * style, the next date to dress for and price drops on watched pieces.
 * Nothing here needs the user to have added a single piece of clothing.
 */
export default function HomeScreen() {
  const t = useTheme();
  const { t: s, lang } = useI18n();
  const { user, updateUser } = useAuth();
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [shop, setShop] = useState<Product[] | null>(null);

  const load = useCallback(() => {
    readWeather(user, updateUser)
      .then((wx) => {
        setWeather(wx);
        return catalog.home(wx?.lat, wx?.lon);
      })
      .then(setFeed)
      .catch(() => catalog.home().then(setFeed).catch(() => {}));
    // The user object changes when the location is saved; refetching then would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saved hearts and dates change on other tabs; refresh on return.
  useFocusEffect(load);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? s.home.morning : hour < 18 ? s.home.afternoon : s.home.evening;
  const date = new Date().toLocaleDateString(LOCALES[lang], { weekday: 'long', day: 'numeric', month: 'long' });
  const occ = feed?.occasion;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={styles.wrap} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.textSecondary} />}>
        <View style={{ gap: 4 }}>
          <Text style={[type.caption, { color: t.textMuted, textTransform: 'capitalize' }]}>{date}</Text>
          <Text style={[type.display, { color: t.text }]}>
            {greeting}{user?.display_name ? `, ${user.display_name.split(' ')[0]}` : ''}
          </Text>
          <Text style={[type.body, { color: t.textSub }]}>{s.feed.sub}</Text>
          {weather ? (
            <View style={[styles.weatherPill, { backgroundColor: t.card }, elevation(t)]}><WeatherLine info={weather} /></View>
          ) : null}
        </View>

        <GuestBanner />

        {!feed ? (
          <View style={{ gap: space.md }}>
            <LoadingSkeleton height={280} radius={radius.lg} />
            <LoadingSkeleton height={22} width="55%" />
          </View>
        ) : (
          <>
            {feed.look ? <LookCard look={feed.look} title={s.feed.todayLook} kicker={s.product.lookKicker} onShop={() => setShop(feed.look!.items)} /> : null}

            {feed.picks.length ? (
              <View style={{ gap: space.md }}>
                <SectionHeader title={s.feed.picked} action={s.home.seeAll} onAction={() => router.push('/discover')} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }}
                  contentContainerStyle={{ gap: space.md, paddingHorizontal: gutter }}>
                  {feed.picks.map((p) => <ProductTile key={p.id} product={p} onPress={() => setShop([p])} />)}
                </ScrollView>
              </View>
            ) : null}

            <Pressable onPress={() => router.push('/dates')} accessibilityRole="button"
              style={({ pressed }) => [styles.occasion, { backgroundColor: t.highlightBg, opacity: pressed ? 0.85 : 1 }]}>
              {occ ? (
                <View style={[styles.count, { backgroundColor: t.card }]}>
                  <Text style={[type.title, { color: t.text }]}>{occ.days}</Text>
                </View>
              ) : (
                <View style={[styles.count, { backgroundColor: t.card }]}><CalendarHeart size={22} color={t.primary} /></View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyStrong, { color: t.text }]}>{occ ? s.feed.daysUntil(occ.days, occ.title) : s.feed.addDate}</Text>
                <Text style={[type.caption, { color: t.textSub }]}>{occ ? (occ.ready ? s.feed.occasionReady : s.feed.occasionLater) : s.feed.addDateSub}</Text>
              </View>
              <ChevronRight size={18} color={t.text} />
            </Pressable>

            {feed.price_drops.length ? (
              <View style={{ gap: space.md }}>
                <SectionHeader title={s.feed.priceDropped} />
                {feed.price_drops.map(({ product, drop }) => (
                  <Pressable key={product.id} onPress={() => setShop([product])} accessibilityRole="button"
                    style={({ pressed }) => [styles.drop, { borderColor: t.border, backgroundColor: pressed ? t.cardAlt : t.card }]}>
                    <TrendingDown size={18} color={t.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{product.name}</Text>
                      <Text style={[type.caption, { color: t.textMuted }]}>{product.store}</Text>
                    </View>
                    <Text style={[type.bodyStrong, { color: t.success }]}>
                      {s.wishlist.dropped(money(drop[0], product.currency), money(drop[1], product.currency))}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <ShopSheet products={shop} onClose={() => setShop(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingTop: space.lg, gap: space.xxl, paddingBottom: space.xxl * 2 },
  weatherPill: { alignSelf: 'flex-start', paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 999, marginTop: space.sm },
  occasion: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  count: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  drop: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
});
