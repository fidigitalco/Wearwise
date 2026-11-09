import { Image } from 'expo-image';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { GarmentForm, draftFromGarment, draftToInput, type GarmentDraft } from '../../components/GarmentForm';
import { Body, Button, Card, Chip, ChipRow, FormScroll, Label } from '../../components/ui';
import { formatTemp } from '../../components/Outfit';
import { useAuth } from '../../lib/auth';
import { errorMessage, garments as garmentsApi, mediaUrl } from '../../services/api';
import { useI18n, useLabel } from '../../lib/i18n';
import { useMeta } from '../../lib/meta';
import { gutter, radius, space, useTheme } from '../../theme';
import type { Garment } from '../../types';

export default function GarmentScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const justAdded = fresh === '1';
  const t = useTheme();
  const meta = useMeta();
  const navigation = useNavigation();
  const { t: s } = useI18n();
  const label = useLabel();
  const { user } = useAuth();
  const [garment, setGarment] = useState<Garment | null>(null);
  const [draft, setDraft] = useState<GarmentDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    garmentsApi
      .get(id)
      .then((g) => {
        setGarment(g);
        setDraft(draftFromGarment(g));
        navigation.setOptions({ title: g.name || label(g.subcategory ? 'subcategories' : 'categories', g.subcategory || g.category) });
      })
      .catch((e) => {
        Alert.alert(s.garment.couldNotOpen, errorMessage(e));
        router.back();
      });
    // Labels follow the language at load time; re-running on every render would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigation]);

  if (!garment || !draft) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.text} />
      </View>
    );
  }

  const src = mediaUrl(garment.image || garment.cutout);

  const save = async () => {
    setSaving(true);
    try {
      const g = await garmentsApi.update(garment.id, draftToInput(draft));
      setGarment(g);
      router.back();
    } catch (e) {
      Alert.alert(s.common.couldNotSave, errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: Garment['status']) => {
    try {
      setGarment(await garmentsApi.update(garment.id, { status }));
    } catch (e) {
      Alert.alert(s.common.couldNotUpdate, errorMessage(e));
    }
  };

  const remove = () =>
    Alert.alert(s.garment.deleteTitle, s.garment.deleteBody, [
      { text: s.common.cancel, style: 'cancel' },
      {
        text: s.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await garmentsApi.remove(garment.id);
            router.back();
          } catch (e) {
            Alert.alert(s.common.couldNotDelete, errorMessage(e));
          }
        },
      },
    ]);


  return (
    <FormScroll contentContainerStyle={styles.wrap}>
        {src ? <Image source={{ uri: src }} style={[styles.photo, { backgroundColor: t.cardAlt }]} contentFit="contain" /> : null}

        {justAdded ? (
          <Card style={{ backgroundColor: t.highlightBg, borderColor: t.highlightBg }}>
            <Body>{s.garment.justAdded}</Body>
          </Card>
        ) : (
          <Body muted>
            {s.garment.worn(garment.times_worn)}
            {garment.last_worn_at ? s.garment.lastOn(garment.last_worn_at) : ''}
          </Body>
        )}

        {garment.weather_fit && (garment.weather_fit.min_temp_c !== null || garment.weather_fit.rain_suitable) ? (
          <Body muted>
            {[
              garment.weather_fit.min_temp_c !== null
                ? s.garment.comfy(`${formatTemp(garment.weather_fit.min_temp_c, user?.units)} – ${formatTemp(garment.weather_fit.max_temp_c, user?.units)}`)
                : null,
              garment.weather_fit.rain_suitable ? s.garment.rainOk : null,
            ].filter(Boolean).join(' · ')}
          </Body>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Label>{s.garment.status}</Label>
          <ChipRow>
            {meta.statuses.map((st) => (
              <Chip key={st} label={label('statuses', st)} selected={garment.status === st} onPress={() => setStatus(st as Garment['status'])} />
            ))}
          </ChipRow>
          <Body muted>{s.garment.statusHint}</Body>
        </View>

        <GarmentForm draft={draft} onChange={setDraft} confidence={garment.attribute_confidence} />

        <Button title={justAdded ? s.common.done : s.garment.saveChanges} onPress={save} loading={saving} />
        <Button title={s.garment.deletePiece} variant="danger" onPress={remove} />
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.lg },
});
