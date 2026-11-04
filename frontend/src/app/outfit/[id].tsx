import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Bookmark, Check, Heart, RefreshCw, Repeat, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { GarmentImage } from '../../components/Garment';
import { useToast } from '../../components/Overlays';
import { OutfitCollage, WeatherSummary } from '../../components/Outfit';
import { SwapSheet } from '../../components/SwapSheet';
import { Button, Chip, CompatibilityScore, ErrorState, IconButton, ScoreBar } from '../../components/ui';
import { useAvatar } from '../../lib/avatar';
import { useI18n, useLabel } from '../../lib/i18n';
import { recentlyViewed } from '../../lib/local';
import { rgbCss } from '../../lib/meta';
import { errorMessage, outfits as outfitsApi } from '../../services/api';
import { gutter, radius, space, type, useTheme } from '../../theme';
import type { Outfit } from '../../types';

const SLOT_ORDER = ['outerwear', 'top', 'dress', 'bottom', 'shoes', 'accessory', 'bag'];
const FACTORS = ['color', 'occasion', 'weather', 'silhouette', 'material', 'taste'] as const;

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [failed, setFailed] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [worn, setWorn] = useState(false);
  const [swapSlot, setSwapSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState<'another' | 'wear' | null>(null);
  const [view, setView] = useState<'collage' | 'avatar'>('collage');
  const avatar = useAvatar();

  useEffect(() => {
    outfitsApi
      .get(id)
      .then((o) => {
        setOutfit(o);
        recentlyViewed.add(o.id);
      })
      .catch(() => setFailed(true));
  }, [id]);

  const title = outfit?.title || s.looks.fallbackTitle;
  useEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: () =>
        outfit ? <IconButton icon={<Share2 size={20} color={t.text} />} label={s.detail.share} onPress={share} /> : null,
    });
    // `share` reads the current outfit; the header only needs refreshing when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, outfit, t]);

  if (failed) return <ErrorState message={s.detail.notFound} onRetry={() => router.back()} retryLabel={s.common.back} />;
  if (!outfit) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  const items = [...outfit.items].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  const pieceName = (g: Outfit['items'][number]['garment']) => g.name || label('subcategories', g.subcategory) || label('categories', g.category);
  const reasons = outfit.reasons?.length ? outfit.reasons : outfit.explanation ? [outfit.explanation] : [];
  const seasons = Array.from(new Set(items.flatMap((i) => i.garment.season)));

  async function share() {
    if (!outfit) return;
    const pieces = outfit.items.map((i) => pieceName(i.garment)).join(', ');
    try {
      await Share.share({ message: s.detail.shareText(outfit.title || s.looks.fallbackTitle, pieces) });
    } catch {}
  }

  const toggleSave = async () => {
    try {
      const updated = await outfitsApi.setSaved(outfit.id, !outfit.saved);
      setOutfit(updated);
      toast(updated.saved ? s.looks.savedToast : s.looks.unsavedToast);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const like = () => {
    const next = liked === true ? null : true;
    setLiked(next);
    if (next) outfitsApi.feedback({ outfit: outfit.id, liked: true, rank: outfit.position + 1 }).catch(() => {});
  };

  const wear = async () => {
    setBusy('wear');
    try {
      await outfitsApi.wear(outfit.id);
      setWorn(true);
      toast(s.detail.wornToast);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const another = async () => {
    setBusy('another');
    try {
      const c = outfit.context;
      const set = await outfitsApi.recommend({
        occasion: c?.occasion || 'casual',
        temp_c: c?.temp_c ?? null,
        precip_prob: c?.precip_prob ?? null,
        ...(c?.style ? { style: c.style } : {}),
      });
      if (set.outfits[0]) router.replace({ pathname: '/outfit/[id]', params: { id: set.outfits[0].id } });
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: 120 + insets.bottom }]}>
        <View style={{ gap: space.sm }}>
          <View style={styles.viewToggle}>
            <Chip label={s.avatar.collage} selected={view === 'collage'} onPress={() => setView('collage')} />
            <Chip label={s.avatar.fittingRoom} selected={view === 'avatar'} onPress={() => setView('avatar')} />
            {view === 'avatar' ? (
              <Pressable onPress={() => router.push('/avatar')} accessibilityRole="button" hitSlop={8} style={{ marginLeft: 'auto' }}>
                <Text style={[type.label, { color: t.primary, fontWeight: '600' }]}>{s.avatar.edit}</Text>
              </Pressable>
            ) : null}
          </View>
          {view === 'collage' ? (
            <OutfitCollage outfit={outfit} style={{ aspectRatio: 0.9 }} gap={8} />
          ) : (
            <View style={[styles.stage, { backgroundColor: t.tile }]}>
              <Avatar profile={avatar} items={outfit.items} width={210} />
            </View>
          )}
        </View>

        <View style={{ gap: space.sm }}>
          <View style={styles.titleRow}>
            <Text style={[type.display, { color: t.text, flex: 1, fontSize: 28 }]}>{title}</Text>
            <CompatibilityScore value={outfit.total_score} />
          </View>
          <View style={styles.meta}>
            {outfit.context?.occasion ? <MetaPill text={label('occasions', outfit.context.occasion)} /> : null}
            {outfit.context?.style ? <MetaPill text={label('styles', outfit.context.style)} /> : null}
            <MetaPill text={`${s.detail.season}: ${seasons.length ? seasons.map((x) => label('seasons', x)).join(', ') : s.detail.allYear}`} />
          </View>
          <WeatherSummary temp={outfit.context?.temp_c} rain={outfit.context?.precip_prob} />
        </View>

        {reasons.length ? (
          <View style={{ gap: space.md }}>
            <Text style={[type.title, { color: t.text }]}>{s.detail.whyWorks}</Text>
            {reasons.map((r, i) => (
              <View key={i} style={styles.reason}>
                <View style={[styles.bullet, { backgroundColor: t.primary }]} />
                <Text style={[type.body, { color: t.textSub, flex: 1 }]}>{r}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ gap: space.md }}>
          <Text style={[type.title, { color: t.text }]}>{s.detail.factors}</Text>
          <View style={{ gap: space.sm }}>
            {FACTORS.map((k) => <ScoreBar key={k} label={s.outfit.scores[k]} value={outfit.scores?.[k] ?? 0} />)}
          </View>
        </View>

        <View style={{ gap: space.xs }}>
          <View style={styles.row}>
            <Text style={[type.title, { color: t.text, flex: 1 }]}>{s.detail.pieces}</Text>
            <Text style={[type.caption, { color: t.textMuted }]}>{s.detail.replaceHint}</Text>
          </View>
          {items.map(({ slot, garment }) => (
            <View key={garment.id} style={[styles.piece, { borderBottomColor: t.border }]}>
              <Pressable style={styles.pieceMain} accessibilityRole="button" accessibilityLabel={pieceName(garment)}
                onPress={() => router.push({ pathname: '/garment/[id]', params: { id: garment.id } })}>
                <GarmentImage garment={garment} style={{ width: 64, height: 72 }} iconSize={24} rounded={radius.sm} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{pieceName(garment)}</Text>
                  <View style={styles.row}>
                    {garment.colors[0] ? <View style={[styles.dot, { backgroundColor: rgbCss(garment.colors[0].rgb), borderColor: t.border }]} /> : null}
                    <Text style={[type.caption, { color: t.textMuted }]}>
                      {label('categories', garment.category)}
                      {garment.colors[0] ? ` · ${label('colors', garment.colors[0].name)}` : ''}
                    </Text>
                  </View>
                </View>
              </Pressable>
              <Button title={s.detail.swapShort} variant="secondary" size="sm" onPress={() => setSwapSlot(slot)}
                icon={<Repeat size={14} color={t.text} strokeWidth={1.6} />} />
            </View>
          ))}
        </View>

        <View style={styles.secondary}>
          <Button title={s.detail.another} variant="secondary" style={{ flex: 1 }} loading={busy === 'another'} onPress={another}
            icon={<RefreshCw size={16} color={t.text} />} size="sm" />
        </View>
      </ScrollView>

      <View style={[styles.sticky, { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: insets.bottom + space.sm }]}>
        <IconButton active={outfit.saved} label={outfit.saved ? s.outfit.saved : s.outfit.save} onPress={toggleSave}
          icon={<Bookmark size={22} color={t.text} fill={outfit.saved ? t.text : 'transparent'} strokeWidth={1.6} />} />
        <IconButton active={liked === true} label={s.outfit.like} onPress={like}
          icon={<Heart size={22} color={t.text} fill={liked ? t.text : 'transparent'} strokeWidth={1.6} />} />
        <Button title={worn ? s.outfit.worn : s.detail.worn} style={{ flex: 1 }} onPress={worn ? undefined : wear} disabled={worn}
          loading={busy === 'wear'} icon={worn ? <Check size={18} color={t.onPrimary} /> : undefined} />
      </View>

      <SwapSheet
        outfit={swapSlot ? outfit : null}
        slot={swapSlot}
        onClose={() => setSwapSlot(null)}
        onSwapped={(o) => { setOutfit(o); toast(s.detail.swapped); }}
      />
    </View>
  );
}

function MetaPill({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: t.cardAlt }]}>
      <Text style={[type.caption, { color: t.textSub }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  viewToggle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stage: { aspectRatio: 0.9, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  wrap: { paddingHorizontal: gutter, paddingTop: space.md, gap: space.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  reason: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  piece: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1 },
  pieceMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth },
  secondary: { flexDirection: 'row', gap: space.md },
  sticky: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: gutter, paddingTop: space.sm, borderTopWidth: 1,
  },
});
