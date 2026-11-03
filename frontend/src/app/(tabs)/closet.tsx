import { router, useFocusEffect } from 'expo-router';
import {
  ArrowUpDown, Check, Heart, MoreHorizontal, PenLine, Plus, Search, SlidersHorizontal, Trash, WashingMachine,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { GarmentCard } from '../../components/Garment';
import { Hanger } from '../../components/icons';
import { AddSheet } from '../../components/AddSheet';
import { BottomSheet, ConfirmationDialog, SheetAction, useToast } from '../../components/Overlays';
import { Button, Chip, ChipRow, ChipWrap, EmptyState, ErrorState, IconButton, LoadingSkeleton, SearchField } from '../../components/ui';
import { useI18n, useLabel } from '../../lib/i18n';
import { rgbCss, useMeta } from '../../lib/meta';
import { errorMessage, garments as garmentsApi } from '../../services/api';
import { gutter, space, type, useTheme } from '../../theme';
import type { Category, Garment } from '../../types';

type Sort = 'newest' | 'name' | 'mostWorn' | 'leastWorn';
type Filters = { color: string | null; season: string | null; status: string | null; favorites: boolean };
const NO_FILTERS: Filters = { color: null, season: null, status: null, favorites: false };
const CHIP_ORDER: (Category | 'all')[] = ['all', 'top', 'bottom', 'outerwear', 'dress', 'shoes', 'bag', 'accessory'];

export default function WardrobeScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const meta = useMeta();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<Garment[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [sort, setSort] = useState<Sort>('newest');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sheet, setSheet] = useState<'add' | 'sort' | 'filter' | 'more' | null>(null);
  const [actionsFor, setActionsFor] = useState<Garment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Garment | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await garmentsApi.list());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const replace = (g: Garment) => setItems((xs) => xs?.map((x) => (x.id === g.id ? g : x)) ?? null);

  const toggleFavorite = async (g: Garment) => {
    replace({ ...g, favorite: !g.favorite });
    try {
      replace(await garmentsApi.setFavorite(g.id, !g.favorite));
    } catch (e) {
      replace(g);
      toast(errorMessage(e), 'error');
    }
  };

  const setStatus = async (g: Garment, status: Garment['status']) => {
    setActionsFor(null);
    try {
      replace(await garmentsApi.update(g.id, { status }));
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const remove = async (g: Garment) => {
    setConfirmDelete(null);
    try {
      await garmentsApi.remove(g.id);
      setItems((xs) => xs?.filter((x) => x.id !== g.id) ?? null);
      toast(s.wardrobe.deleted);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const removeSamples = async () => {
    try {
      await garmentsApi.removeSample();
      toast(s.wardrobe.samplesRemoved);
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const active = useMemo(() => (items ?? []).filter((g) => g.status !== 'archived'), [items]);
  const counts = useMemo(() => {
    const c: Partial<Record<string, number>> = { all: active.length };
    for (const g of active) c[g.category] = (c[g.category] ?? 0) + 1;
    return c;
  }, [active]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = active.filter((g) => {
      if (category !== 'all' && g.category !== category) return false;
      if (filters.favorites && !g.favorite) return false;
      if (filters.color && !g.colors.some((c) => c.name === filters.color)) return false;
      if (filters.season && g.season.length && !g.season.includes(filters.season)) return false;
      if (filters.status && g.status !== filters.status) return false;
      if (!q) return true;
      const hay = [g.name, label('categories', g.category), label('subcategories', g.subcategory), ...g.colors.map((c) => label('colors', c.name))]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
    const byName = (g: Garment) => (g.name || label('subcategories', g.subcategory)).toLowerCase();
    return [...list].sort((a, b) =>
      sort === 'name' ? byName(a).localeCompare(byName(b))
        : sort === 'mostWorn' ? b.times_worn - a.times_worn
          : sort === 'leastWorn' ? a.times_worn - b.times_worn
            : b.created_at.localeCompare(a.created_at),
    );
  }, [active, category, filters, query, sort, label]);

  const filterCount = Object.values(filters).filter(Boolean).length;
  const hasSamples = active.some((g) => g.is_sample);
  const gap = space.lg;
  const cardWidth = (width - gutter * 2 - gap) / 2;

  const header = (
    <View style={{ gap: space.md, marginBottom: space.md }}>
      <AppHeader
        title={s.wardrobe.title}
        subtitle={items ? s.wardrobe.count(active.length) : undefined}
        right={
          <>
            <IconButton icon={<Search size={22} color={searching ? t.primary : t.text} strokeWidth={1.6} />} label={s.wardrobe.search}
              onPress={() => { setSearching((v) => !v); setQuery(''); }} active={searching} />
            {/* Rare, destructive actions live behind "more", not in red on the header. */}
            {hasSamples ? (
              <IconButton icon={<MoreHorizontal size={22} color={t.text} strokeWidth={1.6} />} label={s.common.more}
                onPress={() => setSheet('more')} />
            ) : null}
          </>
        }
      />
      {searching ? <SearchField value={query} onChangeText={setQuery} placeholder={s.wardrobe.search} autoFocus /> : null}
      <ChipRow>
        {CHIP_ORDER.filter((c) => c === 'all' || counts[c]).map((c) => (
          <Chip key={c} label={`${s.wardrobe.categoriesPlural[c]}${counts[c] ? ` ${counts[c]}` : ''}`}
            selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ChipRow>
      <View style={styles.tools}>
        <Pressable onPress={() => setSheet('filter')} accessibilityRole="button" style={styles.tool}>
          <SlidersHorizontal size={16} color={filterCount ? t.primary : t.textSub} />
          <Text style={[type.label, { color: filterCount ? t.primary : t.textSub }]}>
            {s.wardrobe.filter}{filterCount ? ` · ${filterCount}` : ''}
          </Text>
        </Pressable>
        <Pressable onPress={() => setSheet('sort')} accessibilityRole="button" style={styles.tool}>
          <ArrowUpDown size={16} color={t.textSub} />
          <Text style={[type.label, { color: t.textSub }]}>{sortLabel(sort, s)}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      {items === null ? (
        <View style={styles.wrap}>
          {header}
          {error ? (
            <ErrorState message={s.common.networkError} onRetry={load} retryLabel={s.common.tryAgain} />
          ) : (
            <View style={{ flexDirection: 'row', gap }}>
              <LoadingSkeleton width={cardWidth} height={cardWidth * 1.45} />
              <LoadingSkeleton width={cardWidth} height={cardWidth * 1.45} />
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(g) => g.id}
          numColumns={2}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={styles.wrap}
          ItemSeparatorComponent={() => <View style={{ height: gap }} />}
          ListHeaderComponent={header}
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          ListEmptyComponent={
            active.length === 0 ? (
              <EmptyState
                illustration={<Hanger size={48} color={t.textSecondary} strokeWidth={1.2} />}
                title={s.wardrobe.emptyTitle}
                body={s.wardrobe.emptyBody}
                action={<Button title={s.wardrobe.emptyAction} onPress={() => setSheet('add')} icon={<Plus size={18} color={t.onPrimary} />} />}
              />
            ) : (
              <EmptyState title={s.search.noResults} body={s.wardrobe.noResults}
                action={<Button title={s.wardrobe.reset} variant="secondary" onPress={() => { setFilters(NO_FILTERS); setQuery(''); setCategory('all'); }} />} />
            )
          }
          renderItem={({ item }) => (
            <GarmentCard
              garment={item}
              width={cardWidth}
              onPress={() => router.push({ pathname: '/garment/[id]', params: { id: item.id } })}
              onToggleFavorite={() => toggleFavorite(item)}
              onMore={() => setActionsFor(item)}
            />
          )}
        />
      )}

      <AddSheet visible={sheet === 'add'} onClose={() => setSheet(null)} />

      <BottomSheet visible={sheet === 'more'} onClose={() => setSheet(null)} closeLabel={s.common.close}>
        <SheetAction danger icon={<Trash size={20} color={t.danger} />} label={s.wardrobe.removeSamples}
          onPress={() => { setSheet(null); removeSamples(); }} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'sort'} onClose={() => setSheet(null)} title={s.wardrobe.sort} closeLabel={s.common.close}>
        {(['newest', 'name', 'mostWorn', 'leastWorn'] as Sort[]).map((o) => (
          <SheetAction key={o} label={sortLabel(o, s)} onPress={() => { setSort(o); setSheet(null); }}
            icon={sort === o ? <Check size={20} color={t.primary} /> : <View style={{ width: 20 }} />} />
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'filter'} onClose={() => setSheet(null)} title={s.wardrobe.filters} closeLabel={s.common.close}>
        <Text style={[type.label, { color: t.textSub }]}>{s.wardrobe.color}</Text>
        <ChipWrap>
          {Object.entries(meta.colors).map(([name, rgb]) => (
            <Chip key={name} label={label('colors', name)} swatch={rgbCss(rgb)} selected={filters.color === name}
              onPress={() => setFilters((f) => ({ ...f, color: f.color === name ? null : name }))} />
          ))}
        </ChipWrap>
        <Text style={[type.label, { color: t.textSub }]}>{s.wardrobe.season}</Text>
        <ChipWrap>
          {meta.seasons.map((x) => (
            <Chip key={x} label={label('seasons', x)} selected={filters.season === x}
              onPress={() => setFilters((f) => ({ ...f, season: f.season === x ? null : x }))} />
          ))}
        </ChipWrap>
        <Text style={[type.label, { color: t.textSub }]}>{s.wardrobe.status}</Text>
        <ChipWrap>
          {meta.statuses.filter((x) => x !== 'archived').map((x) => (
            <Chip key={x} label={label('statuses', x)} selected={filters.status === x}
              onPress={() => setFilters((f) => ({ ...f, status: f.status === x ? null : x }))} />
          ))}
        </ChipWrap>
        <Chip label={s.wardrobe.favoritesOnly} selected={filters.favorites} icon={<Heart size={14} color={filters.favorites ? t.onPrimary : t.textSub} />}
          onPress={() => setFilters((f) => ({ ...f, favorites: !f.favorites }))} />
        <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
          <Button title={s.wardrobe.reset} variant="secondary" style={{ flex: 1 }} onPress={() => setFilters(NO_FILTERS)} />
          <Button title={s.wardrobe.apply} style={{ flex: 1 }} onPress={() => setSheet(null)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={!!actionsFor} onClose={() => setActionsFor(null)} closeLabel={s.common.close}
        title={actionsFor ? actionsFor.name || label('subcategories', actionsFor.subcategory) : undefined}>
        {actionsFor ? (
          <>
            <SheetAction icon={<PenLine size={20} color={t.primary} />} label={s.wardrobe.edit}
              onPress={() => { const g = actionsFor; setActionsFor(null); router.push({ pathname: '/garment/[id]', params: { id: g.id } }); }} />
            <SheetAction icon={<Heart size={20} color={t.primary} />} label={actionsFor.favorite ? s.wardrobe.unfavorite : s.wardrobe.favorite}
              onPress={() => { const g = actionsFor; setActionsFor(null); toggleFavorite(g); }} />
            <SheetAction icon={<WashingMachine size={20} color={t.primary} />}
              label={actionsFor.status === 'laundry' ? s.wardrobe.available : s.wardrobe.laundry}
              onPress={() => setStatus(actionsFor, actionsFor.status === 'laundry' ? 'available' : 'laundry')} />
            <SheetAction icon={<Trash size={20} color={t.danger} />} label={s.garment.deletePiece} danger
              onPress={() => { setConfirmDelete(actionsFor); setActionsFor(null); }} />
          </>
        ) : null}
      </BottomSheet>

      <ConfirmationDialog
        visible={!!confirmDelete}
        title={s.garment.deleteTitle}
        message={s.garment.deleteBody}
        confirmLabel={s.common.delete}
        cancelLabel={s.common.cancel}
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />

    </SafeAreaView>
  );
}

function sortLabel(sort: Sort, s: ReturnType<typeof useI18n>['t']) {
  return { newest: s.wardrobe.sortNewest, name: s.wardrobe.sortName, mostWorn: s.wardrobe.sortMostWorn, leastWorn: s.wardrobe.sortLeastWorn }[sort];
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: gutter, paddingTop: space.lg, paddingBottom: space.xxl * 2 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
});
