import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, CircleAlert, CircleCheck, CircleX, Image as ImageIcon, PenLine, Video } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View,
  useWindowDimensions,
} from 'react-native';
import { GarmentForm, draftToInput, emptyDraft, type GarmentDraft } from '../../components/GarmentForm';
import { Hanger } from '../../components/icons';
import { Body, Button, FormScroll, Title } from '../../components/ui';
import { errorMessage, garments as garmentsApi, mediaUrl, scans, type LocalImage } from '../../services/api';
import { useI18n } from '../../lib/i18n';
import { gutter, radius, space, useTheme } from '../../theme';
import type { Garment } from '../../types';

type Status = 'pending' | 'working' | 'done' | 'needsType' | 'noClothing' | 'error';
type Item = { image: LocalImage; status: Status; garment?: Garment };

const MAX_PHOTOS = 10;
const MAX_VIDEO_SECONDS = 30;
const POLL_MS = 2500;
const POLL_LIMIT_MS = 5 * 60 * 1000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Add pieces: snap one photo, pick several, or film the wardrobe, and the
 * server's AI tagger fills in each piece. One piece opens straight on itself
 * for a quick check; several end on a summary. The form only appears for a
 * piece that could not be recognised, or when adding without a photo.
 */
export default function NewGarmentScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const { mode } = useLocalSearchParams<{ mode?: 'camera' | 'library' | 'video' | 'manual' }>();
  // "Add manually" from the Wardrobe sheet opens straight on the form.
  const [manualFor, setManualFor] = useState<number | 'none' | null>(mode === 'manual' ? 'none' : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<GarmentDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [videoPhase, setVideoPhase] = useState<'uploading' | 'scanning' | null>(null);

  const single = items.length === 1;
  const manual = manualFor !== null;
  const manualImage = typeof manualFor === 'number' ? items[manualFor]?.image : undefined;

  const update = (i: number, patch: Partial<Item>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  /** Upload one photo; the server recognises it and creates the piece. */
  const recognise = async (img: LocalImage): Promise<Pick<Item, 'status' | 'garment'>> => {
    try {
      return { status: 'done', garment: await garmentsApi.create({}, img) };
    } catch (e: any) {
      const data = e?.response?.data;
      if (data?.image) return { status: 'noClothing' };
      if (data?.category) return { status: 'needsType' };
      return { status: 'error' };
    }
  };

  const run = async (images: LocalImage[]) => {
    setItems(images.map((image) => ({ image, status: 'pending' })));
    setManualFor(null);
    setNotice(null);
    setRunning(true);
    // One at a time: steady progress and no burst of AI calls.
    const results: Pick<Item, 'status' | 'garment'>[] = [];
    for (let i = 0; i < images.length; i++) {
      update(i, { status: 'working' });
      const r = await recognise(images[i]);
      results.push(r);
      update(i, r);
    }
    setRunning(false);

    if (images.length === 1) {
      const r = results[0];
      if (r.status === 'done' && r.garment) {
        router.replace({ pathname: '/garment/[id]', params: { id: r.garment.id, fresh: '1' } });
      } else if (r.status === 'noClothing') {
        setItems([]);
        Alert.alert(s.add.anotherPhoto, s.add.noClothing);
      } else if (r.status === 'needsType') {
        openManual(0);
      } else {
        Alert.alert(s.add.couldNotAdd, s.common.genericError);
      }
    }
  };

  const openManual = (i: number | 'none') => {
    setDraft(emptyDraft());
    setManualFor(i);
    setNotice(i === 'none' ? null : s.add.notRecognised);
  };

  /** Ask for access and let the user pick; resolves to the photos, or null if they backed out. */
  const chooseImages = async (source: 'camera' | 'library' | 'many'): Promise<LocalImage[] | null> => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(source === 'camera' ? s.add.cameraOff : s.add.photosOff, s.add.turnOn);
      return null;
    }
    const res =
      source === 'camera'
        // One shot at a time, so the person can crop it to just the garment.
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true })
        : source === 'library'
          // One photo from the gallery gets the same crop step as the camera.
          ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true })
          // Several at once: the picker cannot crop a multiple selection.
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
              allowsMultipleSelection: true,
              selectionLimit: MAX_PHOTOS,
            });
    if (res.canceled || !res.assets.length) return null;
    return res.assets.slice(0, MAX_PHOTOS).map((a) => ({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName }));
  };

  const pick = (source: 'camera' | 'library' | 'many') => chooseImages(source).then((images) => images && run(images));

  const chooseVideo = () =>
    Alert.alert(s.add.videoTitle, s.add.videoHint, [
      { text: s.add.recordVideo, onPress: () => pickVideo('camera') },
      { text: s.add.pickVideo, onPress: () => pickVideo('library') },
      { text: s.common.cancel, style: 'cancel' },
    ]);

  const pickVideo = async (source: 'camera' | 'library') => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(source === 'camera' ? s.add.cameraOff : s.add.photosOff, s.add.turnOn);
      return;
    }
    const res =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: MAX_VIDEO_SECONDS })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    runVideo({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName });
  };

  const runVideo = async (video: LocalImage) => {
    setItems([]);
    setVideoPhase('uploading');
    try {
      let scan = await scans.create(video);
      setVideoPhase('scanning');
      const started = Date.now();
      while (scan.status === 'processing' && Date.now() - started < POLL_LIMIT_MS) {
        await wait(POLL_MS);
        scan = await scans.get(scan.id);
      }
      setVideoPhase(null);
      if (scan.status === 'processing' || scan.status === 'failed') {
        Alert.alert(s.add.couldNotAdd, scan.error === 'no_frames' ? s.add.videoNoFrames : s.add.videoFailed);
        return;
      }
      if (scan.garments.length === 0) {
        Alert.alert(s.add.couldNotAdd, s.add.videoNothing);
      } else if (scan.garments.length === 1) {
        router.replace({ pathname: '/garment/[id]', params: { id: scan.garments[0].id, fresh: '1' } });
      } else {
        setItems(scan.garments.map((g) => ({ image: { uri: mediaUrl(g.image) ?? '' }, status: 'done', garment: g })));
      }
    } catch (e: any) {
      setVideoPhase(null);
      Alert.alert(s.add.couldNotAdd, e?.response?.data?.code === 'ai_unavailable' ? s.add.videoNoAi : errorMessage(e));
    }
  };

  const saveManual = async () => {
    if (!draft.subcategory) {
      Alert.alert(s.add.pickTypeTitle, s.add.pickTypeBody);
      return;
    }
    if (!manualImage && draft.colors.length === 0) {
      Alert.alert(s.add.pickColorTitle, s.add.pickColorBody);
      return;
    }
    setSaving(true);
    try {
      const input = draftToInput(draft);
      // With a photo and no manual picks, the server detects the colours.
      if (manualImage && draft.colors.length === 0) delete input.colors;
      const g = await garmentsApi.create(input, manualImage);
      if (typeof manualFor === 'number' && !single) {
        update(manualFor, { status: 'done', garment: g });
        setManualFor(null);
      } else {
        router.back();
      }
    } catch (e) {
      Alert.alert(s.common.couldNotSave, errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // Opened from the Wardrobe "Add clothing" sheet: go straight to the chosen way of adding.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !mode) return;
    started.current = true;
    if (mode === 'camera' || mode === 'library') chooseImages(mode).then((images) => images && run(images));
    else if (mode === 'video') chooseVideo();
    // Runs once on open; the handlers are stable for that purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const doneCount = items.filter((x) => x.status === 'done').length;
  const processed = items.filter((x) => x.status !== 'pending' && x.status !== 'working').length;
  const tile = (width - space.lg * 2 - space.md * 2) / 3;

  // ── Manual form (no photo, or a photo that was not recognised) ────────────
  if (manual) {
    return (
      <FormScroll contentContainerStyle={styles.wrap}>
          {manualImage ? (
            <Image source={{ uri: manualImage.uri }} style={[styles.photo, { backgroundColor: t.cardAlt }]} contentFit="contain" />
          ) : null}
          {notice ? <Body>{notice}</Body> : null}
          <GarmentForm draft={draft} onChange={setDraft} colorsHint={manualImage ? s.add.colorsFromPhoto : undefined} />
          <Button title={s.add.save} onPress={saveManual} loading={saving} />
          {!single && items.length ? <Button title={s.common.cancel} variant="ghost" onPress={() => setManualFor(null)} /> : null}
      </FormScroll>
    );
  }

  // ── Several photos: progress, then a summary ─────────────────────────────
  if (items.length > 1) {
    return (
      <ScrollView contentContainerStyle={styles.wrap}>
        <Title>{running ? s.add.progress(Math.min(processed + 1, items.length), items.length) : s.add.added(doneCount)}</Title>
        {!running && doneCount ? <Body muted>{s.add.addedHint}</Body> : null}
        <View style={styles.grid}>
          {items.map((it, i) => (
            <Pressable
              key={`${i}-${it.image.uri}`}
              disabled={running || it.status === 'pending' || it.status === 'working'}
              onPress={() => {
                if (it.status === 'done' && it.garment) {
                  router.push({ pathname: '/garment/[id]', params: { id: it.garment.id, fresh: '1' } });
                } else if (it.status === 'needsType' || it.status === 'error') {
                  openManual(i);
                }
              }}
              accessibilityRole="button"
              style={{ width: tile }}
            >
              <Image source={{ uri: it.image.uri }} style={[styles.tile, { width: tile, height: tile, backgroundColor: t.cardAlt }]} contentFit="cover" />
              <StatusLine item={it} />
            </Pressable>
          ))}
        </View>
        <Button title={s.add.finish} onPress={() => router.back()} disabled={running} />
      </ScrollView>
    );
  }

  // ── Start: take a photo or pick from the gallery ─────────────────────────
  const working = (running && single) || !!videoPhase;
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View>
        {single ? (
          <Image source={{ uri: items[0].image.uri }} style={[styles.photo, { backgroundColor: t.cardAlt }]} contentFit="contain" />
        ) : (
          <View style={[styles.photo, styles.placeholder, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
            <Hanger size={44} color={t.primary} strokeWidth={1.6} />
            <Text style={{ color: t.textSub, textAlign: 'center' }}>{s.add.placeholder}</Text>
          </View>
        )}
        {working ? (
          <View style={[styles.photo, styles.overlay, { backgroundColor: t.overlay }]}>
            <ActivityIndicator color={t.onImage} size="large" />
            <Text style={[styles.overlayText, { color: t.onImage }]}>
              {videoPhase === 'uploading' ? s.add.uploading : videoPhase === 'scanning' ? s.add.scanning : s.add.recognising}
            </Text>
            {videoPhase === 'scanning' ? <Text style={[styles.overlaySub, { color: t.onImage }]}>{s.add.scanningHint}</Text> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.row}>
        <Button
          title={s.add.takePhoto}
          style={{ flex: 1 }}
          disabled={working}
          onPress={() => pick('camera')}
          icon={<Camera size={18} color={t.onPrimary} />}
        />
        <Button
          title={s.add.photos}
          variant="secondary"
          style={{ flex: 1 }}
          disabled={working}
          onPress={() => pick('library')}
          icon={<ImageIcon size={18} color={t.text} />}
        />
      </View>
      <Pressable onPress={() => pick('many')} disabled={working} accessibilityRole="button" hitSlop={8}>
        <Text style={{ textAlign: 'center', color: t.primary, fontWeight: '600', opacity: working ? 0.5 : 1 }}>{s.add.multiHint}</Text>
      </Pressable>
      <Button
        title={s.add.video}
        variant="secondary"
        disabled={working}
        onPress={chooseVideo}
        icon={<Video size={18} color={t.text} />}
      />
      <Body muted style={{ textAlign: 'center' }}>{s.add.videoHint}</Body>

      {!working ? (
        <Pressable onPress={() => openManual('none')} accessibilityRole="button" style={styles.link}>
          <Text style={{ color: t.textSub, textDecorationLine: 'underline' }}>{s.add.byHand}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function StatusLine({ item }: { item: Item }) {
  const t = useTheme();
  const { t: s } = useI18n();
  if (item.status === 'pending') return <Text style={[styles.status, { color: t.textMuted }]}>…</Text>;
  if (item.status === 'working') return <ActivityIndicator style={{ marginTop: 4 }} color={t.textMuted} />;
  const [Icon, color, text] = {
    done: [CircleCheck, t.success, item.garment?.name || s.add.addedHint] as const,
    needsType: [PenLine, t.highlight, s.add.needsType] as const,
    noClothing: [CircleX, t.danger, s.add.noClothingShort] as const,
    error: [CircleAlert, t.danger, s.add.failed] as const,
  }[item.status];
  return (
    <View style={styles.statusRow}>
      <Icon size={14} color={color} />
      <Text numberOfLines={1} style={[styles.status, { color: t.textSub, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.lg },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: space.md, borderWidth: 1, borderStyle: 'dashed', padding: space.xl },
  overlay: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: space.md },
  overlayText: { fontSize: 16, fontWeight: '600' },
  overlaySub: { fontSize: 13, opacity: 0.85 },
  row: { flexDirection: 'row', gap: space.md },
  link: { alignSelf: 'center', paddingVertical: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { borderRadius: radius.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  status: { fontSize: 12 },
});
