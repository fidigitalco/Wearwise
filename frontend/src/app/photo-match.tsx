import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, Crown, ImageIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '../components/Overlays';
import { ProductTile, ShopSheet } from '../components/Products';
import { Button, FormScroll } from '../components/ui';
import { useI18n, useLabel } from '../lib/i18n';
import { errorMessage, photoMatch, type PhotoMatchResult } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';
import type { Product } from '../types';

/** Photo match (build prompt §2.6): a screenshot or photo → the closest buyable pieces in your size. */
export default function PhotoMatchScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const toast = useToast();
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PhotoMatchResult | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const [shop, setShop] = useState<Product[] | null>(null);

  const pick = async (camera: boolean) => {
    const res = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    const a = !res.canceled ? res.assets[0] : null;
    if (!a) return;
    setPhoto(a.uri);
    setResult(null);
    setBusy(true);
    try {
      setResult(await photoMatch({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName }));
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (code === 'photo_limit') setLimitHit(true);
      else toast(code === 'not_recognised' ? s.photo.notRecognised : errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const detected = result
    ? [label('colors', result.detected.color), label('subcategories', result.detected.subcategory), result.detected.material].filter(Boolean).join(' ')
    : '';

  return (
    <>
      <FormScroll style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
        <Text style={[type.body, { color: t.textSub }]}>{s.photo.cardSub}</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Button title={s.photo.pick} variant="secondary" onPress={() => pick(false)} icon={<ImageIcon size={18} color={t.text} />} /></View>
          <View style={{ flex: 1 }}><Button title={s.photo.camera} variant="secondary" onPress={() => pick(true)} icon={<Camera size={18} color={t.text} />} /></View>
        </View>

        {limitHit ? (
          <Pressable onPress={() => router.push('/premium')} accessibilityRole="button"
            style={({ pressed }) => [styles.upsell, { backgroundColor: t.highlightBg, opacity: pressed ? 0.85 : 1 }]}>
            <Crown size={22} color={t.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyStrong, { color: t.text }]}>{s.photo.limit}</Text>
              <Text style={[type.caption, { color: t.textSub }]}>{s.photo.limitBody}</Text>
            </View>
          </Pressable>
        ) : null}

        {photo ? <Image source={{ uri: photo }} style={[styles.photo, { backgroundColor: t.cardAlt }]} contentFit="cover" /> : null}
        {busy ? (
          <View style={styles.row}>
            <ActivityIndicator color={t.primary} />
            <Text style={[type.body, { color: t.textSub }]}>{s.photo.analysing}</Text>
          </View>
        ) : null}

        {result ? (
          <View style={{ gap: space.md }}>
            <Text style={[type.bodyStrong, { color: t.text }]}>{s.photo.detected(detected)}</Text>
            {result.left !== null ? <Text style={[type.caption, { color: t.textMuted }]}>{s.photo.left(result.left)}</Text> : null}
            {result.results.length ? (
              <View style={styles.grid}>
                {result.results.map((p) => (
                  <View key={p.id} style={{ gap: 4 }}>
                    <ProductTile product={p} width={160} onPress={() => setShop([p])} />
                    <Text style={[type.caption, { color: t.primary, fontWeight: '700' }]}>{s.photo.alike(p.alike)}</Text>
                  </View>
                ))}
              </View>
            ) : <Text style={[type.body, { color: t.textMuted }]}>{s.photo.none}</Text>}
          </View>
        ) : null}
      </FormScroll>
      <ShopSheet products={shop} onClose={() => setShop(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.lg, paddingBottom: space.xxl * 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  upsell: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'space-between' },
});
