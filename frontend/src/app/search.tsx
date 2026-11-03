import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Clock, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GarmentCard } from '../components/Garment';
import { useToast } from '../components/Overlays';
import { OutfitCollage } from '../components/Outfit';
import { Chip, ChipRow, EmptyState, LoadingSkeleton, SearchField, SectionHeader } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n, useLabel } from '../lib/i18n';
import { recentSearches } from '../lib/local';
import { CATEGORY_ORDER, rgbCss, useMeta } from '../lib/meta';
import { errorMessage, garments as garmentsApi, outfits as outfitsApi } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';
import type { Garment, Outfit } from '../types';

const TEMPLATES: { style: string; photo: number }[] = [
  { style: 'smart_casual', photo: require('../../assets/images/style-smart_casual.jpg') },
  { style: 'minimal', photo: require('../../assets/images/style-minimal.jpg') },
  { style: 'streetwear', photo: require('../../assets/images/style-streetwear.jpg') },
  { style: 'classic', photo: require('../../assets/images/style-classic.jpg') },
];

type Filter = { kind: 'category' | 'color' | 'occasion' | 'season' | 'style'; value: string } | null;

export default function SearchScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const meta = useMeta();
  const toast = useToast();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [garments, setGarments] = useState<Garment[] | null>(null);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [suggested, setSuggested] = useState<Outfit[]>([]);

  useEffect(() => {
    recentSearches.get().then(setRecent);
    garmentsApi.list().then(setGarments).catch(() => setGarments([]));
    outfitsApi.list().then(setOutfits).catch(() => {});
    outfitsApi.latest(user?.main_occasion || 'casual').then((set) => set && setSuggested(set.outfits)).catch(() => {});
  }, [user?.main_occasion]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0 || filter !== null;

  const garmentText = (g: Garment) =>
    [g.name, label('categories', g.category), label('subcategories', g.subcategory), ...g.colors.map((c) => label('colors', c.name)),
      ...g.season.map((x) => label('seasons', x)), ...g.occasion_tags.map((x) => label('occasions', x))].join(' ').toLowerCase();

  const garmentHits = useMemo(() => (garments ?? []).filter((g) => {
    if (filter?.kind === 'category' && g.category !== filter.value) return false;
    if (filter?.kind === 'color' && !g.colors.some((c) => c.name === filter.value)) return false;
    if (filter?.kind === 'season' && g.season.length && !g.season.includes(filter.value)) return false;
    if (filter?.kind === 'occasion' || filter?.kind === 'style') return false;
    return !q || garmentText(g).includes(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [garments, q, filter, label]);

  const outfitHits = useMemo(() => outfits.filter((o) => {
    if (filter?.kind === 'occasion' && o.context?.occasion !== filter.value) return false;
    if (filter?.kind === 'style' && o.context?.style !== filter.value) return false;
    if (filter?.kind === 'color' && !o.palette.includes(filter.value)) return false;
    if (filter?.kind === 'category' && !o.items.some((i) => i.garment.category === filter.value)) return false;
    if (filter?.kind === 'season' && o.context?.season !== filter.value) return false;
    if (!q) return true;
    const text = [o.title, label('occasions', o.context?.occasion), ...o.items.map((i) => garmentText(i.garment))].join(' ').toLowerCase();
    return text.includes(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [outfits, q, filter, label]);

  const remember = () => {
    if (q) recentSearches.add(query).then(setRecent);
  };

  const openTemplate = async (style: string) => {
    try {
      const set = await outfitsApi.recommend({ occasion: user?.main_occasion || 'casual', style });
      if (set.outfits[0]) router.push({ pathname: '/outfit/[id]', params: { id: set.outfits[0].id } });
    } catch (e: any) {
      toast(e?.response?.data?.code === 'not_enough_garments' ? s.today.needClosetBody : errorMessage(e), 'error');
    }
  };

  const cardWidth = (width - space.lg * 2 - space.md) / 2;
  const isOn = (kind: NonNullable<Filter>['kind'], value: string) => filter?.kind === kind && filter.value === value;
  const pick = (kind: NonNullable<Filter>['kind'], value: string) => setFilter(isOn(kind, value) ? null : { kind, value });
  const savedOutfits = outfits.filter((o) => o.saved);

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <SearchField value={query} onChangeText={setQuery} placeholder={s.search.placeholder} autoFocus onSubmit={remember} />

      <ChipRow>
        {CATEGORY_ORDER.map((c) => <Chip key={c} label={label('categories', c)} selected={isOn('category', c)} onPress={() => pick('category', c)} />)}
        {Object.keys(meta.occasions).map((o) => <Chip key={o} label={label('occasions', o)} selected={isOn('occasion', o)} onPress={() => pick('occasion', o)} />)}
        {meta.seasons.map((x) => <Chip key={x} label={label('seasons', x)} selected={isOn('season', x)} onPress={() => pick('season', x)} />)}
      </ChipRow>
      <ChipRow>
        {Object.entries(meta.colors).map(([name, rgb]) => (
          <Chip key={name} label={label('colors', name)} swatch={rgbCss(rgb)} selected={isOn('color', name)} onPress={() => pick('color', name)} />
        ))}
        {meta.style_directions.map((x) => <Chip key={x} label={label('styles', x)} selected={isOn('style', x)} onPress={() => pick('style', x)} />)}
      </ChipRow>

      {!searching ? (
        <>
          {recent.length ? (
            <View style={{ gap: space.sm }}>
              <SectionHeader title={s.search.recent} action={s.search.clear} onAction={() => { recentSearches.clear(); setRecent([]); }} />
              {recent.map((r) => (
                <Pressable key={r} onPress={() => setQuery(r)} accessibilityRole="button" style={styles.recent}>
                  <Clock size={16} color={t.textMuted} />
                  <Text style={[type.body, { color: t.text, flex: 1 }]}>{r}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {savedOutfits.length ? (
            <View style={{ gap: space.md }}>
              <SectionHeader title={s.search.savedOutfits} action={s.home.seeAll} onAction={() => router.push('/saved')} />
              <OutfitStrip outfits={savedOutfits.slice(0, 8)} />
            </View>
          ) : null}

          {garments?.length ? (
            <View style={{ gap: space.md }}>
              <SectionHeader title={s.search.recentlyAdded} action={s.home.seeAll} onAction={() => router.push('/closet')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                {garments.slice(0, 8).map((g) => (
                  <GarmentCard key={g.id} garment={g} width={140} onPress={() => router.push({ pathname: '/garment/[id]', params: { id: g.id } })} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {suggested.length ? (
            <View style={{ gap: space.md }}>
              <SectionHeader title={s.search.suggested} />
              <OutfitStrip outfits={suggested} />
            </View>
          ) : null}

          <View style={{ gap: space.md }}>
            <SectionHeader title={s.search.templates} />
            <View style={styles.templates}>
              {TEMPLATES.map((tpl) => (
                <Pressable key={tpl.style} onPress={() => openTemplate(tpl.style)} accessibilityRole="button" accessibilityLabel={label('styles', tpl.style)}
                  style={[styles.template, { width: cardWidth }]}>
                  <Image source={tpl.photo} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <View style={[styles.templateShade, { backgroundColor: t.imageShade }]} />
                  <Text style={[type.subtitle, { color: t.onImage }]}>{label('styles', tpl.style)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      ) : garments === null ? (
        <LoadingSkeleton height={200} />
      ) : garmentHits.length === 0 && outfitHits.length === 0 ? (
        <EmptyState illustration={<X size={32} color={t.primary} />} title={s.search.noResults} body={s.search.noResultsBody} />
      ) : (
        <>
          {garmentHits.length ? (
            <View style={{ gap: space.md }}>
              <SectionHeader title={`${s.search.garments} · ${garmentHits.length}`} />
              <View style={styles.grid}>
                {garmentHits.slice(0, 30).map((g) => (
                  <GarmentCard key={g.id} garment={g} width={cardWidth}
                    onPress={() => { remember(); router.push({ pathname: '/garment/[id]', params: { id: g.id } }); }} />
                ))}
              </View>
            </View>
          ) : null}
          {outfitHits.length ? (
            <View style={{ gap: space.md }}>
              <SectionHeader title={`${s.search.outfits} · ${outfitHits.length}`} />
              <OutfitStrip outfits={outfitHits.slice(0, 20)} onOpen={remember} />
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function OutfitStrip({ outfits, onOpen }: { outfits: Outfit[]; onOpen?: () => void }) {
  const t = useTheme();
  const { t: s } = useI18n();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
      {outfits.map((o) => (
        <Pressable key={o.id} onPress={() => { onOpen?.(); router.push({ pathname: '/outfit/[id]', params: { id: o.id } }); }}
          accessibilityRole="button" accessibilityLabel={o.title || s.looks.fallbackTitle}
          style={[styles.strip, { backgroundColor: t.card, borderColor: t.border }]}>
          <OutfitCollage outfit={o} style={{ aspectRatio: 1 }} gap={4} />
          <Text style={[type.label, { color: t.text, fontWeight: '600', paddingHorizontal: 4 }]} numberOfLines={1}>{o.title || s.looks.fallbackTitle}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  strip: { width: 160, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 6, gap: 6 },
  templates: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  template: { height: 140, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', padding: space.md },
  templateShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
