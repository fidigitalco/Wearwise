import { Image } from 'expo-image';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { GarmentForm, draftToInput, type GarmentDraft } from '../../components/GarmentForm';
import { Body, Button, Chip, ChipRow, Label } from '../../components/ui';
import { errorMessage, garments as garmentsApi, mediaUrl } from '../../lib/api';
import { humanize, useMeta } from '../../lib/meta';
import { radius, space, useTheme } from '../../lib/theme';
import type { Garment } from '../../lib/types';

function toDraft(g: Garment): GarmentDraft {
  return {
    name: g.name, category: g.category, subcategory: g.subcategory, pattern: g.pattern, fit: g.fit,
    formality: g.formality, warmth: g.warmth, rain_ok: g.rain_ok, season: g.season, colors: g.colors,
    materialValue: g.material?.value ?? '',
  };
}

export default function GarmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const meta = useMeta();
  const navigation = useNavigation();
  const [garment, setGarment] = useState<Garment | null>(null);
  const [draft, setDraft] = useState<GarmentDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    garmentsApi
      .get(id)
      .then((g) => {
        setGarment(g);
        setDraft(toDraft(g));
        navigation.setOptions({ title: g.name || humanize(g.subcategory || g.category) });
      })
      .catch((e) => {
        Alert.alert('Could not open this piece', errorMessage(e));
        router.back();
      });
  }, [id, navigation]);

  if (!garment || !draft) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.text} />
      </View>
    );
  }

  const src = mediaUrl(garment.cutout || garment.image);

  const save = async () => {
    setSaving(true);
    try {
      const g = await garmentsApi.update(garment.id, draftToInput(draft));
      setGarment(g);
      router.back();
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: Garment['status']) => {
    try {
      setGarment(await garmentsApi.update(garment.id, { status }));
    } catch (e) {
      Alert.alert('Could not update', errorMessage(e));
    }
  };

  const remove = () =>
    Alert.alert('Delete this piece?', 'It is removed from your closet and from saved outfits.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await garmentsApi.remove(garment.id);
            router.back();
          } catch (e) {
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
    ]);

  const lowColorConfidence = (garment.attribute_confidence?.color ?? 1) < 0.75;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        {src ? <Image source={{ uri: src }} style={[styles.photo, { backgroundColor: t.cardAlt }]} contentFit="contain" /> : null}

        <Body muted>
          Worn {garment.times_worn} {garment.times_worn === 1 ? 'time' : 'times'}
          {garment.last_worn_at ? ` · last on ${garment.last_worn_at}` : ''}
        </Body>

        <View style={{ gap: space.sm }}>
          <Label>Status</Label>
          <ChipRow>
            {meta.statuses.map((s) => (
              <Chip key={s} label={humanize(s)} selected={garment.status === s} onPress={() => setStatus(s as Garment['status'])} />
            ))}
          </ChipRow>
          <Body muted>Only available pieces are used in suggestions.</Body>
        </View>

        <GarmentForm
          draft={draft}
          onChange={setDraft}
          colorsHint={lowColorConfidence ? 'The photo was dark, so check these colours.' : undefined}
        />

        <Button title="Save changes" onPress={save} loading={saving} />
        <Button title="Delete piece" variant="danger" onPress={remove} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.lg },
});
