import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { Camera, ImageIcon, Link2, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GarmentSketch } from '../components/GarmentSketch';
import { useToast } from '../components/Overlays';
import { Button, EmptyState, Field, FormScroll } from '../components/ui';
import { useI18n, useLabel } from '../lib/i18n';
import { errorMessage, inspirations as api, type Inspiration, type LocalImage } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';

/**
 * The inspiration board: anything the user liked, shared as a photo
 * (screenshot, street style, a store) or a link (Instagram, Pinterest, a
 * product page). Each is read for type and colour and counts towards their
 * taste like a save, so Discover and Home learn from it.
 */
export default function InspirationScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<Inspiration[] | null>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const tile = (width - gutter * 2 - space.md) / 2;

  useFocusEffect(useCallback(() => {
    api.list().then((d) => setItems(d.items)).catch(() => setItems([]));
  }, []));

  const add = (p: Promise<Inspiration>) => {
    setBusy(true);
    p.then((i) => {
      setItems((xs) => [i, ...(xs ?? [])]);
      setLink('');
      toast(s.inspo.added);
    })
      .catch((e) => toast(e?.response?.data?.link?.[0] ?? errorMessage(e), 'error'))
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
    if (a) add(api.photo({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName } as LocalImage));
  };

  const remove = (i: Inspiration) =>
    api.remove(i.id).then(() => setItems((xs) => xs?.filter((x) => x.id !== i.id) ?? null)).catch((e) => toast(errorMessage(e), 'error'));

  const kind = (i: Inspiration) =>
    [i.color ? label('colors', i.color) : '', i.subcategory ? label('subcategories', i.subcategory).toLowerCase() : ''].filter(Boolean).join(' ');

  return (
    <FormScroll style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      <Text style={[type.body, { color: t.textSub }]}>{s.inspo.sub}</Text>

      <View style={[styles.box, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Button title={s.inspo.photo} icon={<Camera size={18} color={t.onPrimary} />} onPress={() => pick('camera')} disabled={busy} /></View>
          <View style={{ flex: 1 }}><Button title={s.inspo.library} variant="secondary" icon={<ImageIcon size={18} color={t.text} />} onPress={() => pick('library')} disabled={busy} /></View>
        </View>
        <Field value={link} onChangeText={setLink} placeholder={s.inspo.linkPlaceholder} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Button title={s.inspo.addLink} variant="secondary" icon={<Link2 size={18} color={t.text} />} onPress={() => add(api.link(link.trim()))}
          loading={busy} disabled={!link.trim()} />
      </View>

      {items && items.length === 0 ? <EmptyState title={s.inspo.title} body={s.inspo.empty} /> : null}
      <View style={styles.grid}>
        {items?.map((i) => (
          <View key={i.id} style={{ width: tile, gap: 6 }}>
            <Pressable onPress={() => (i.link ? Linking.openURL(i.link).catch(() => {}) : undefined)} accessibilityRole={i.link ? 'link' : undefined}
              style={[styles.tile, { width: tile, height: tile, backgroundColor: t.tile }]}>
              {i.image ? (
                <Image source={{ uri: i.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              ) : i.rgb ? (
                <GarmentSketch subcategory={i.subcategory} category="top" rgb={i.rgb} size={tile * 0.6} />
              ) : (
                <Link2 size={32} color={t.textMuted} />
              )}
              <Pressable onPress={() => remove(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={s.inspo.remove}
                style={[styles.remove, { backgroundColor: t.card }]}>
                <Trash2 size={14} color={t.textSecondary} />
              </Pressable>
            </Pressable>
            <Text style={[type.caption, { color: kind(i) ? t.text : t.textMuted }]} numberOfLines={1}>
              {kind(i) ? s.inspo.read(kind(i)) : s.inspo.unread}
            </Text>
            {i.link ? <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={1}>{i.link.replace(/^https?:\/\/(www\.)?/, '')}</Text> : null}
          </View>
        ))}
      </View>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.xl, paddingBottom: space.xxl * 2 },
  box: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { borderRadius: radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
