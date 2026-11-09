import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { Camera, Check, ChevronRight, ImageIcon, Sparkles, TriangleAlert } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { GarmentSketch } from '../../components/GarmentSketch';
import { useToast } from '../../components/Overlays';
import { ProductTile, ShopSheet } from '../../components/Products';
import { Button, Field, FormScroll, SectionHeader } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { errorMessage, suitsMe, type LocalImage, type SuitsMe } from '../../services/api';
import { gutter, radius, space, type, useTheme } from '../../theme';
import type { Product } from '../../types';

/**
 * Stylist (MVP v2 §3): "Does this suit me?" for a piece seen in a store or
 * online: a photo or a link in, a verdict on style and colour out, with three
 * alternatives. Five free a month. The chat stylist is one tap away.
 */
export default function StylistScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const [left, setLeft] = useState<number | null | undefined>(undefined);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SuitsMe | null>(null);
  const [shop, setShop] = useState<Product[] | null>(null);

  useFocusEffect(useCallback(() => {
    suitsMe.left().then(setLeft).catch(() => {});
  }, []));

  const run = (p: Promise<SuitsMe>) => {
    setBusy(true);
    p.then((r) => {
      setResult(r);
      setLeft(r.left);
    })
      .catch((e) => {
        const code = e?.response?.data?.code;
        if (code === 'checks_used') setLeft(0);
        toast(code === 'checks_used' ? s.suits.outOfChecks : e?.response?.data?.detail ?? errorMessage(e), 'error');
      })
      .finally(() => setBusy(false));
  };

  const pick = async (source: 'camera' | 'library') => {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(source === 'camera' ? s.add.cameraOff : s.add.photosOff, s.add.turnOn);
      return;
    }
    const res = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    const a = !res.canceled ? res.assets[0] : null;
    if (a) run(suitsMe.photo({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName } as LocalImage));
  };

  const out = left === 0;
  const line = (ok: boolean | null, text: string) => (
    <View style={styles.line}>
      {ok === false ? <TriangleAlert size={16} color={t.danger} /> : <Check size={16} color={ok ? t.success : t.textMuted} />}
      <Text style={[type.body, { color: t.textSub, flex: 1 }]}>{text}</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <FormScroll contentContainerStyle={styles.wrap}>
        <AppHeader title={s.suits.title} />
        <Text style={[type.body, { color: t.textSub, marginTop: -space.md }]}>{s.suits.sub}</Text>

        <View style={[styles.drop, { borderColor: t.border, backgroundColor: t.card }]}>
          <Text style={[type.caption, { color: t.textMuted }]}>{left === null ? s.suits.unlimited : left === undefined ? ' ' : s.suits.left(left)}</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Button title={s.suits.photo} icon={<Camera size={18} color={t.onPrimary} />} onPress={() => pick('camera')} disabled={out || busy} /></View>
            <View style={{ flex: 1 }}><Button title={s.suits.library} variant="secondary" icon={<ImageIcon size={18} color={t.text} />} onPress={() => pick('library')} disabled={out || busy} /></View>
          </View>
          <Field value={link} onChangeText={setLink} placeholder={s.suits.linkPlaceholder} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Button title={busy ? s.suits.checking : s.suits.checkLink} variant="secondary" onPress={() => run(suitsMe.link(link.trim()))} loading={busy} disabled={out || !link.trim()} />
          {out ? (
            <View style={styles.row}>
              <Text style={[type.caption, { color: t.textSub, flex: 1 }]}>{s.suits.outOfChecks}</Text>
              <Button title={s.suits.seePremium} size="sm" variant="ghost" onPress={() => router.push('/premium')} />
            </View>
          ) : null}
        </View>

        {result ? (
          <View style={[styles.verdict, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={styles.row}>
              {result.rgb ? (
                <View style={[styles.sketch, { backgroundColor: t.tile }]}>
                  <GarmentSketch subcategory={result.subcategory ?? ''} category={result.category ?? 'top'} rgb={result.rgb} size={60} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={[type.display, { color: t.text, fontSize: 36 }]}>{result.score}%</Text>
                <Text style={[type.bodyStrong, { color: t.text }]}>{s.suits.verdicts[result.verdict]}</Text>
              </View>
            </View>
            {line(result.style_ok, result.style_ok ? s.suits.styleYes : s.suits.styleNo)}
            {line(result.color_fit === 'avoid' ? false : result.color_fit === 'unknown' ? null : true,
              { love: s.suits.colorLove, avoid: s.suits.colorAvoid, ok: s.suits.colorOk, unknown: s.suits.colorUnknown }[result.color_fit])}
            {result.pairs_with > 0 ? line(true, s.suits.pairs(result.pairs_with)) : null}
            {result.alternatives.length ? (
              <View style={{ gap: space.md, marginTop: space.sm }}>
                <SectionHeader title={result.better_color ? s.suits.better : s.suits.alternatives} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                  {result.alternatives.map((p) => <ProductTile key={p.id} product={p} width={130} onPress={() => setShop([p])} />)}
                </ScrollView>
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable onPress={() => router.push('/assistant')} accessibilityRole="button"
          style={({ pressed }) => [styles.chat, { backgroundColor: t.highlightBg, opacity: pressed ? 0.85 : 1 }]}>
          <Sparkles size={22} color={t.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.bodyStrong, { color: t.text }]}>{s.suits.chat}</Text>
            <Text style={[type.caption, { color: t.textSub }]}>{s.suits.chatSub}</Text>
          </View>
          <ChevronRight size={18} color={t.text} />
        </Pressable>
      </FormScroll>
      <ShopSheet products={shop} onClose={() => setShop(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingTop: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  drop: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  verdict: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  sketch: { width: 76, height: 76, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  chat: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
});
