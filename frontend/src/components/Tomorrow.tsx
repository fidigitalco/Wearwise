import { router, useFocusEffect } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { FALLBACK, readWeather } from '../lib/weather';
import { calendar } from '../services/api';
import { radius, space, type, useTheme } from '../theme';
import type { CalendarDay } from '../types';
import { formatTemp, OutfitCollage, outfitTitle, WeatherIcon } from './Outfit';
import { Button } from './ui';

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Tomorrow on the Today screen: its forecast and the outfit planned for it, or
 * a nudge to pick one now. Opens the calendar on tomorrow to pick or change it.
 */
export function TomorrowCard() {
  const t = useTheme();
  const { t: s } = useI18n();
  const { user, updateUser } = useAuth();
  const [day, setDay] = useState<CalendarDay | null>(null);

  // Refetch on focus so a plan kept in the calendar shows on return.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      readWeather(user, updateUser)
        .then((wx) => calendar.day(tomorrowIso(), wx?.lat ?? FALLBACK.lat, wx?.lon ?? FALLBACK.lon))
        .then((d) => alive && setDay(d))
        .catch(() => {});
      return () => {
        alive = false;
      };
      // The user object changes when the location is saved; refetching then would loop.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const open = () => router.push({ pathname: '/calendar', params: { date: tomorrowIso() } });
  const wx = day?.weather;
  const plan = day?.plan;

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={styles.head}>
        <Text style={[type.overline, { color: t.textMuted, flex: 1 }]}>{s.tomorrow.title}</Text>
        {wx ? (
          <View style={styles.weather}>
            <WeatherIcon temp={wx.temp_c} rain={wx.precip_prob} size={16} color={t.textSub} />
            <Text style={[type.caption, { color: t.textSub }]}>
              {formatTemp(wx.temp_min_c, user?.units)} / {formatTemp(wx.temp_max_c, user?.units)} · {s.today.rain(Math.round(wx.precip_prob * 100))}
            </Text>
          </View>
        ) : null}
      </View>
      {plan ? (
        <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${s.tomorrow.ready}: ${outfitTitle(plan, s.looks.fallbackTitle)}`}
          style={({ pressed }) => [styles.plan, { opacity: pressed ? 0.7 : 1 }]}>
          <OutfitCollage outfit={plan} style={styles.thumb} gap={2} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.bodyStrong, { color: t.text }]}>{s.tomorrow.ready}</Text>
            <Text style={[type.caption, { color: t.textSub }]} numberOfLines={2}>{outfitTitle(plan, s.looks.fallbackTitle)}</Text>
          </View>
          <Text style={[type.label, { color: t.primary, fontWeight: '600' }]}>{s.tomorrow.change}</Text>
          <ChevronRight size={16} color={t.primary} />
        </Pressable>
      ) : (
        <View style={{ gap: space.md }}>
          <Text style={[type.body, { color: t.textSub }]}>{s.tomorrow.planHint}</Text>
          <Button title={s.tomorrow.plan} variant="secondary" onPress={open} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  weather: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 64, aspectRatio: 0.9, borderRadius: radius.md, overflow: 'hidden' },
});
