import { router, useFocusEffect } from 'expo-router';
import { Bookmark, Heart, LayoutGrid, List } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GarmentCard } from '../components/Garment';
import { useToast } from '../components/Overlays';
import { OutfitCollage, WeatherSummary } from '../components/Outfit';
import { Chip, ChipRow, CompatibilityScore, EmptyState, IconButton, LoadingSkeleton, SearchField } from '../components/ui';
import { useI18n, useLabel } from '../lib/i18n';
import { recentlyViewed } from '../lib/local';
import { errorMessage, garments as garmentsApi, outfits as outfitsApi } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';
import type { Garment, Outfit } from '../types';

type Tab = 'outfits' | 'favorites' | 'recent';

export default function SavedScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('outfits');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState('');
  const [occasion, setOccasion] = useState<string | null>(null);
  const [saved, setSaved] = useState<Outfit[] | null>(null);
  const [favorites, setFavorites] = useState<Garment[] | null>(null);
  const [recent, setRecent] = useState<Outfit[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      outfitsApi.list({ saved: true }).then(setSaved).catch(() => setSaved([]));
      garmentsApi.list({ favorite: true }).then(setFavorites).catch(() => setFavorites([]));
      recentlyViewed.get().then(async (ids) => {
        const got = await Promise.all(ids.map((id) => outfitsApi.get(id).catch(() => null)));
        setRecent(got.filter(Boolean) as Outfit[]);
      });
    }, []),
  );

  const q = query.trim().toLowerCase();
  const outfitList = tab === 'outfits' ? saved : tab === 'recent' ? recent : null;
  const shownOutfits = useMemo(
    () => (outfitList ?? []).filter((o) => {
      if (occasion && o.context?.occasion !== occasion) return false;
      if (!q) return true;
      return [o.title, label('occasions', o.context?.occasion), ...o.items.map((i) => i.garment.name || label('subcategories', i.garment.subcategory))]
        .join(' ').toLowerCase().includes(q);
    }),
    [outfitList, occasion, q, label],
  );
  const shownFavorites = useMemo(
    () => (favorites ?? []).filter((g) => !q || [g.name, label('subcategories', g.subcategory), label('categories', g.category)].join(' ').toLowerCase().includes(q)),
    [favorites, q, label],
  );
  const occasions = Array.from(new Set((outfitList ?? []).map((o) => o.context?.occasion).filter(Boolean))) as string[];

  const unsave = async (o: Outfit) => {
    try {
      await outfitsApi.setSaved(o.id, false);
      setSaved((xs) => xs?.filter((x) => x.id !== o.id) ?? null);
      toast(s.looks.unsavedToast);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const unfavorite = async (g: Garment) => {
    setFavorites((xs) => xs?.filter((x) => x.id !== g.id) ?? null);
    try {
      await garmentsApi.setFavorite(g.id, false);
    } catch (e) {
      setFavorites((xs) => (xs ? [g, ...xs] : xs));
      toast(errorMessage(e), 'error');
    }
  };

  const gap = space.md;
  const half = (width - space.lg * 2 - gap) / 2;
  const loading = tab === 'favorites' ? favorites === null : outfitList === null;

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <View style={styles.tabs}>
        {(['outfits', 'favorites', 'recent'] as Tab[]).map((x) => (
          <Chip key={x} label={s.saved[x]} selected={tab === x} onPress={() => { setTab(x); setOccasion(null); }} />
        ))}
        <View style={{ flex: 1 }} />
        <IconButton
          icon={layout === 'grid' ? <List size={20} color={t.text} /> : <LayoutGrid size={20} color={t.text} />}
          label={layout === 'grid' ? s.saved.list : s.saved.grid}
          onPress={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
        />
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder={s.search.placeholder} />
      {tab !== 'favorites' && occasions.length > 1 ? (
        <ChipRow>
          {occasions.map((o) => <Chip key={o} label={label('occasions', o)} selected={occasion === o} onPress={() => setOccasion(occasion === o ? null : o)} />)}
        </ChipRow>
      ) : null}

      {loading ? (
        <View style={{ flexDirection: 'row', gap }}>
          <LoadingSkeleton width={half} height={half * 1.3} />
          <LoadingSkeleton width={half} height={half * 1.3} />
        </View>
      ) : tab === 'favorites' ? (
        shownFavorites.length ? (
          <View style={layout === 'grid' ? styles.grid : { gap }}>
            {shownFavorites.map((g) => (
              <GarmentCard key={g.id} garment={g} width={layout === 'grid' ? half : width - space.lg * 2}
                onPress={() => router.push({ pathname: '/garment/[id]', params: { id: g.id } })}
                onToggleFavorite={() => unfavorite(g)} />
            ))}
          </View>
        ) : (
          <EmptyState illustration={<Heart size={34} color={t.primary} />} title={s.saved.favorites} body={s.saved.emptyFavorites} />
        )
      ) : shownOutfits.length ? (
        <View style={layout === 'grid' ? styles.grid : { gap }}>
          {shownOutfits.map((o) => (
            <Pressable key={o.id} onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: o.id } })} accessibilityRole="button"
              accessibilityLabel={o.title || s.looks.fallbackTitle}
              style={[styles.item, layout === 'grid' ? { width: half } : styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
              <OutfitCollage outfit={o} style={layout === 'grid' ? { aspectRatio: 0.95 } : { width: 92, aspectRatio: 0.9 }} gap={4} />
              <View style={{ flex: layout === 'list' ? 1 : undefined, gap: 4, padding: 4 }}>
                <View style={styles.titleRow}>
                  <Text style={[type.label, { color: t.text, fontWeight: '600', flex: 1 }]} numberOfLines={1}>{o.title || s.looks.fallbackTitle}</Text>
                  {tab === 'outfits' ? (
                    <Pressable onPress={() => unsave(o)} hitSlop={10} accessibilityRole="button" accessibilityLabel={s.looks.unsavedToast}>
                      <Bookmark size={18} color={t.primary} fill={t.primary} />
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.titleRow}>
                  <Text style={[type.caption, { color: t.textMuted, flex: 1 }]} numberOfLines={1}>{label('occasions', o.context?.occasion)}</Text>
                  <CompatibilityScore value={o.total_score} size="sm" />
                </View>
                {layout === 'list' ? <WeatherSummary temp={o.context?.temp_c} rain={o.context?.precip_prob} compact /> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          illustration={<Bookmark size={34} color={t.primary} />}
          title={s.saved[tab]}
          body={tab === 'outfits' ? s.saved.emptyOutfits : s.saved.emptyRecent}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  item: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 6, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
