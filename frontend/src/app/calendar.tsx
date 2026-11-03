import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OutfitCard, WeatherCard } from '../components/Outfit';
import { useToast } from '../components/Overlays';
import { Button, IconButton } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { FALLBACK, readWeather } from '../lib/weather';
import { calendar, errorMessage, outfits as outfitsApi } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';
import type { CalendarDay, Outfit, OutfitSet } from '../types';

/** YYYY-MM-DD in local time (toISOString would shift to UTC). */
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The month as weeks of seven cells, Monday first; null pads the days outside it. */
function weeks(month: Date): (Date | null)[][] {
  const lead = (month.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** A suggestion for a day; `index` is which of the set's looks is showing. */
type Suggestion = { set: OutfitSet | null; notEnough: boolean; index: number };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pick a date and see that day's outfit: what was worn on a past day, and for
 * today or a future day the outfit planned for it, or a suggestion dressed for
 * its forecast (within two weeks, else the season) that can be kept as the plan.
 * Opened with ?date= to land on a day, e.g. tomorrow from the Today screen.
 */
export default function CalendarScreen() {
  const t = useTheme();
  const { t: s, lang } = useI18n();
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const params = useLocalSearchParams<{ date?: string }>();
  const todayIso = iso(new Date());
  const start = params.date && DATE.test(params.date) ? params.date : todayIso;
  const [month, setMonth] = useState(() => {
    const [y, m] = start.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });
  const [selected, setSelected] = useState(start);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [planned, setPlanned] = useState<string[]>([]);
  // The day whose plan is being swapped for another look, if any.
  const [changing, setChanging] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wornId, setWornId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  // Results keyed by the date they answer, so a stale response never shows under a new date.
  const [day, setDay] = useState<CalendarDay | null>(null);
  const [suggestion, setSuggestion] = useState<{ date: string } & Suggestion | null>(null);
  const suggestions = useRef(new Map<string, Suggestion>());
  const occasion = user?.main_occasion || 'casual';
  const future = selected >= todayIso;

  useEffect(() => {
    readWeather(user, updateUser).then((wx) => setCoords(wx ? { lat: wx.lat, lon: wx.lon } : FALLBACK));
    // Once per visit; the user object changes when the location is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMonth = useCallback(() => {
    calendar.month(iso(month).slice(0, 7))
      .then((r) => {
        setMarks(r.days);
        setPlanned(r.planned);
      })
      .catch(() => setMarks({}));
  }, [month]);

  useEffect(loadMonth, [loadMonth]);

  useEffect(() => {
    if (!coords) return;
    let alive = true;
    calendar.day(selected, coords.lat, coords.lon)
      .then((d) => alive && setDay(d))
      .catch(() => alive && setDay({ date: selected, worn: [], plan: null, weather: null }));
    return () => {
      alive = false;
    };
  }, [selected, coords]);

  const shownDay = day?.date === selected ? day : null;
  const plan = future ? shownDay?.plan ?? null : null;
  // Suggestions are only asked for when there is no plan, or the plan is being swapped.
  const wantSuggestion = future && !!shownDay && (!plan || changing === selected);

  useEffect(() => {
    if (!coords || !wantSuggestion) return;
    let alive = true;
    const hit = suggestions.current.get(selected);
    const request = hit ? Promise.resolve(hit) : suggest(selected, coords);
    request.then((r) => {
      suggestions.current.set(selected, r);
      if (alive) setSuggestion({ date: selected, ...r });
    });
    return () => {
      alive = false;
    };
    // suggest only reads occasion, which is in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, coords, wantSuggestion, occasion]);

  function suggest(date: string, at: { lat: number; lon: number }): Promise<Suggestion> {
    return outfitsApi.recommend({ occasion, date, latitude: at.lat, longitude: at.lon })
      .then((set): Suggestion => ({ set, notEnough: false, index: 0 }))
      .catch((e): Suggestion => ({ set: null, notEnough: e?.response?.data?.code === 'not_enough_garments', index: 0 }));
  }

  /** The next look of the set, then a fresh set once all three were shown. */
  const nextIdea = () => {
    const cur = suggestion?.date === selected ? suggestion : null;
    if (!cur || !coords) return;
    const date = selected;
    const done = (r: Suggestion) => {
      suggestions.current.set(date, r);
      setSuggestion({ date, ...r });
    };
    if (cur.set && cur.index + 1 < cur.set.outfits.length) {
      done({ set: cur.set, notEnough: false, index: cur.index + 1 });
      return;
    }
    setBusy(true);
    suggest(date, coords).then(done).finally(() => setBusy(false));
  };

  const keep = (o: Outfit) => {
    const date = selected;
    setBusy(true);
    calendar.plan(date, o.id)
      .then((kept) => {
        setDay((d) => (d && d.date === date ? { ...d, plan: kept } : d));
        setPlanned((p) => (p.includes(date) ? p : [...p, date]));
        setChanging(null);
        toast(s.calendar.keptToast);
      })
      .catch((e) => toast(errorMessage(e), 'error'))
      .finally(() => setBusy(false));
  };

  const removePlan = () => {
    const date = selected;
    setBusy(true);
    calendar.unplan(date)
      .then(() => {
        setDay((d) => (d && d.date === date ? { ...d, plan: null } : d));
        setPlanned((p) => p.filter((x) => x !== date));
        setChanging(null);
        toast(s.calendar.removedToast);
      })
      .catch((e) => toast(errorMessage(e), 'error'))
      .finally(() => setBusy(false));
  };

  const wear = (o: Outfit) => {
    outfitsApi.wear(o.id)
      .then(() => {
        setWornId(o.id);
        setDay((d) => (d && d.date === todayIso && !d.worn.some((w) => w.id === o.id) ? { ...d, worn: [o, ...d.worn] } : d));
        loadMonth();
        toast(s.home.wornToast);
      })
      .catch((e) => toast(errorMessage(e), 'error'));
  };

  const shiftMonth = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));
  const goToday = () => {
    const d = new Date();
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelected(todayIso);
  };

  const locale = lang === 'az' ? 'az-AZ' : 'en-GB';
  const monthTitle = month.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const [y, m, d] = selected.split('-').map(Number);
  const dayTitle = new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const shownSuggestion = wantSuggestion && suggestion?.date === selected ? suggestion : null;
  const idea = shownSuggestion?.set?.outfits[shownSuggestion.index] ?? null;
  const isToday = selected === todayIso;
  const wornToday = (o: Outfit) => wornId === o.id || !!shownDay?.worn.some((w) => w.id === o.id);
  const open = (id: string) => router.push({ pathname: '/outfit/[id]', params: { id } });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      <View style={[styles.calendar, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={styles.monthRow}>
          <IconButton icon={<ChevronLeft size={22} color={t.text} />} label={s.calendar.prevMonth} onPress={() => shiftMonth(-1)} />
          <Text style={[type.subtitle, { color: t.text, flex: 1, textAlign: 'center', textTransform: 'capitalize' }]}>{monthTitle}</Text>
          <IconButton icon={<ChevronRight size={22} color={t.text} />} label={s.calendar.nextMonth} onPress={() => shiftMonth(1)} />
        </View>
        <View style={styles.week}>
          {s.calendar.weekdays.map((w) => (
            <Text key={w} style={[type.caption, styles.weekday, { color: t.textMuted }]}>{w}</Text>
          ))}
        </View>
        {weeks(month).map((week, wi) => (
          <View key={wi} style={styles.week}>
            {week.map((date, di) => {
              if (!date) return <View key={di} style={styles.cell} />;
              const key = iso(date);
              const isSelected = key === selected;
              const isToday = key === todayIso;
              const worn = marks[key] ?? 0;
              const isPlanned = planned.includes(key);
              return (
                <Pressable
                  key={di}
                  onPress={() => setSelected(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${date.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}${worn ? `, ${s.calendar.wornCount(worn)}` : ''}${isPlanned ? `, ${s.calendar.plannedMark}` : ''}`}
                  style={styles.cell}
                >
                  <View style={[
                    styles.dayCircle,
                    isSelected && { backgroundColor: t.text },
                    !isSelected && isToday && { borderWidth: 1.5, borderColor: t.text },
                  ]}>
                    <Text style={[type.body, { color: isSelected ? t.card : t.text, fontWeight: isToday || isSelected ? '600' : '400' }]}>
                      {date.getDate()}
                    </Text>
                  </View>
                  {/* Filled: worn. Ring: planned ahead. */}
                  <View style={[
                    styles.mark,
                    worn ? { backgroundColor: t.primary } : isPlanned ? { borderWidth: 1.5, borderColor: t.primary } : null,
                  ]} />
                </Pressable>
              );
            })}
          </View>
        ))}
        {selected !== todayIso ? (
          <Pressable onPress={goToday} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center', paddingTop: space.xs }}>
            <Text style={[type.label, { color: t.primary, fontWeight: '600' }]}>{s.calendar.today}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[type.title, { color: t.text, textTransform: 'capitalize' }]} accessibilityRole="header">{dayTitle}</Text>

      {shownDay?.weather ? (
        <WeatherCard info={{ ...shownDay.weather, city: null, fallback: false, lat: coords?.lat ?? FALLBACK.lat, lon: coords?.lon ?? FALLBACK.lon }} />
      ) : null}

      {plan ? (
        <View style={{ gap: space.md }}>
          <Text style={[type.overline, { color: t.textMuted }]}>{s.calendar.planned}</Text>
          <OutfitCard outfit={plan} fallbackTitle={s.looks.fallbackTitle} onOpen={() => open(plan.id)} />
          {isToday ? (
            <Button title={wornToday(plan) ? s.outfit.worn : s.calendar.wear} disabled={wornToday(plan)} onPress={() => wear(plan)} />
          ) : null}
          <View style={styles.actions}>
            <Button title={s.calendar.change} variant="secondary" size="sm" style={{ flex: 1 }}
              onPress={() => setChanging(changing === selected ? null : selected)} />
            <Button title={s.calendar.remove} variant="danger" size="sm" style={{ flex: 1 }} disabled={busy} onPress={removePlan} />
          </View>
        </View>
      ) : null}

      {wantSuggestion ? (
        <View style={{ gap: space.md }}>
          <Text style={[type.overline, { color: t.textMuted }]}>{isToday ? s.calendar.forToday : s.calendar.forDay}</Text>
          {!shownSuggestion ? (
            <ActivityIndicator color={t.primary} style={{ paddingVertical: space.xl }} />
          ) : idea ? (
            <>
              <OutfitCard outfit={idea} fallbackTitle={s.looks.fallbackTitle} onOpen={() => open(idea.id)} />
              {!shownDay?.weather ? (
                <Text style={[type.caption, { color: t.textMuted }]}>{s.calendar.noForecast}</Text>
              ) : null}
              <View style={styles.actions}>
                <Button title={plan ? s.calendar.pickInstead : s.calendar.keep} style={{ flex: 1 }} loading={busy} onPress={() => keep(idea)} />
                <Button title={s.calendar.another} variant="secondary" style={{ flex: 1 }} disabled={busy} onPress={nextIdea} />
              </View>
            </>
          ) : (
            <Text style={[type.body, { color: t.textSub }]}>{shownSuggestion.notEnough ? s.today.needClosetBody : s.assistant.error}</Text>
          )}
        </View>
      ) : future && !shownDay ? (
        <ActivityIndicator color={t.primary} style={{ paddingVertical: space.xl }} />
      ) : null}

      {shownDay && (shownDay.worn.length || !future) ? (
        <View style={{ gap: space.md }}>
          <Text style={[type.overline, { color: t.textMuted }]}>{s.calendar.worn}</Text>
          {shownDay.worn.length ? (
            shownDay.worn.map((o) => (
              <OutfitCard key={o.id} variant="compact" outfit={o} fallbackTitle={s.looks.fallbackTitle} onOpen={() => open(o.id)} />
            ))
          ) : (
            <Text style={[type.body, { color: t.textSub }]}>{s.calendar.nothingWorn}</Text>
          )}
        </View>
      ) : !future ? (
        <ActivityIndicator color={t.primary} style={{ paddingVertical: space.xl }} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingTop: space.md, paddingBottom: space.xxl, gap: space.lg },
  calendar: { borderWidth: 1, borderRadius: radius.xl, padding: space.sm, gap: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: space.xs },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  dayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  actions: { flexDirection: 'row', gap: space.sm },
});
