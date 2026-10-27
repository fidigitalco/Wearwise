import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OutfitCard } from '../../components/OutfitCard';
import { Body, Button, Card, Chip, ChipRow, Empty, Label } from '../../components/ui';
import { errorMessage, getWeather, outfits as outfitsApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { humanize, useMeta } from '../../lib/meta';
import { space, useTheme } from '../../lib/theme';
import type { Outfit, OutfitSet, Weather } from '../../lib/types';

export default function TodayScreen() {
  const t = useTheme();
  const meta = useMeta();
  const { user, updateUser } = useAuth();
  const [occasion, setOccasion] = useState('casual');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherNote, setWeatherNote] = useState<string | null>(null);
  const [set, setSet] = useState<OutfitSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsCloset, setNeedsCloset] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean | null>>({});
  const [worn, setWorn] = useState<string | null>(null);

  const loadWeather = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      let lat = user?.latitude ?? null;
      let lon = user?.longitude ?? null;
      if (perm.granted) {
        const pos =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
        // City-level is all the forecast needs; never store more than that.
        lat = Math.round(pos.coords.latitude * 100) / 100;
        lon = Math.round(pos.coords.longitude * 100) / 100;
        if (lat !== user?.latitude || lon !== user?.longitude) updateUser({ latitude: lat, longitude: lon }).catch(() => {});
      }
      if (lat == null || lon == null) {
        setWeatherNote('Allow location to match outfits to the weather.');
        return;
      }
      setWeather(await getWeather(lat, lon));
      setWeatherNote(null);
    } catch {
      setWeatherNote('Weather is unavailable right now.');
    }
  }, [user?.latitude, user?.longitude, updateUser]);

  useEffect(() => {
    loadWeather();
    // Location is asked for once per visit, not on every user update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styleMe = async () => {
    setLoading(true);
    setNeedsCloset(false);
    try {
      const s = await outfitsApi.recommend({
        occasion,
        temp_c: weather?.temp_c ?? null,
        precip_prob: weather?.precip_prob ?? null,
      });
      setSet(s);
      setLiked({});
      setWorn(null);
    } catch (e: any) {
      if (e?.response?.data?.code === 'not_enough_garments') setNeedsCloset(true);
      else Alert.alert('Could not build outfits', errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const react = async (o: Outfit, value: boolean) => {
    const next = liked[o.id] === value ? null : value;
    setLiked((l) => ({ ...l, [o.id]: next }));
    if (next === null) return;
    try {
      await outfitsApi.feedback({ outfit: o.id, liked: next, rank: o.position + 1 });
    } catch {}
  };

  const toggleSave = async (o: Outfit) => {
    try {
      const updated = await outfitsApi.setSaved(o.id, !o.saved);
      setSet((s) => s && { ...s, outfits: s.outfits.map((x) => (x.id === o.id ? updated : x)) });
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e));
    }
  };

  const wear = async (o: Outfit) => {
    try {
      await outfitsApi.wear(o.id);
      setWorn(o.id);
    } catch (e) {
      Alert.alert('Could not log it', errorMessage(e));
    }
  };

  const greeting = user?.display_name ? `Hi ${user.display_name.split(' ')[0]}` : 'Good to see you';

  return (
    <ScrollView
      contentContainerStyle={styles.wrap}
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadWeather} tintColor={t.textMuted} />}
    >
      <Text style={[styles.hello, { color: t.text }]}>{greeting}</Text>

      <Card style={styles.weather}>
        {weather ? (
          <>
            <Ionicons
              name={weather.precip_prob >= 0.5 ? 'rainy-outline' : weather.temp_c >= 20 ? 'sunny-outline' : 'partly-sunny-outline'}
              size={34}
              color={t.highlight}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.temp, { color: t.text }]}>{Math.round(weather.temp_c)}°C</Text>
              <Body muted>
                {Math.round(weather.temp_min_c)}° – {Math.round(weather.temp_max_c)}° · {Math.round(weather.precip_prob * 100)}% rain
              </Body>
            </View>
          </>
        ) : (
          <Body muted>{weatherNote ?? 'Checking the weather…'}</Body>
        )}
      </Card>

      <View style={{ gap: space.sm }}>
        <Label>Where are you going?</Label>
        <ChipRow>
          {Object.keys(meta.occasions).map((o) => (
            <Chip key={o} label={humanize(o)} selected={o === occasion} onPress={() => setOccasion(o)} />
          ))}
        </ChipRow>
      </View>

      <Button title={set ? 'Show me three more' : 'Style me'} onPress={styleMe} loading={loading} />

      {needsCloset ? (
        <Empty
          title="Your closet needs a few pieces"
          body="Add at least a top and a bottom (or a dress) and some shoes, and WearWise can put looks together."
          action={<Button title="Add a piece" onPress={() => router.push('/garment/new')} />}
        />
      ) : null}

      {set?.outfits.map((o, i) => (
        <OutfitCard
          key={o.id}
          outfit={o}
          index={i}
          liked={liked[o.id]}
          onLike={() => react(o, true)}
          onDislike={() => react(o, false)}
          onToggleSave={() => toggleSave(o)}
          onWear={() => wear(o)}
          worn={worn === o.id}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  hello: { fontSize: 26, fontWeight: '800' },
  weather: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  temp: { fontSize: 28, fontWeight: '700' },
});
