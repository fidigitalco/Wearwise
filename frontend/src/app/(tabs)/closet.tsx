import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GarmentThumb } from '../../components/GarmentThumb';
import { Body, Button, Chip, ChipRow, Empty } from '../../components/ui';
import { garments as garmentsApi } from '../../lib/api';
import { CATEGORY_ORDER, humanize } from '../../lib/meta';
import { space, useTheme } from '../../lib/theme';
import type { Category, Garment } from '../../lib/types';

const COLUMNS = 3;

export default function ClosetScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<Garment[] | null>(null);
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await garmentsApi.list());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  // Refresh whenever the tab regains focus (after adding or editing a piece).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = useMemo(() => {
    const c: Partial<Record<Category, number>> = {};
    for (const g of items ?? []) if (g.status !== 'archived') c[g.category] = (c[g.category] ?? 0) + 1;
    return c;
  }, [items]);

  const shown = useMemo(
    () => (items ?? []).filter((g) => g.status !== 'archived' && (filter === 'all' || g.category === filter)),
    [items, filter],
  );

  const size = (width - space.lg * 2 - space.md * (COLUMNS - 1)) / COLUMNS;

  if (items === null) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        {error ? <Button title="Try again" variant="secondary" onPress={load} /> : <ActivityIndicator color={t.text} />}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={shown}
        keyExtractor={(g) => g.id}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }}
        ListHeaderComponent={
          <View style={{ gap: space.sm, marginBottom: space.sm }}>
            <ChipRow>
              <Chip label={`All ${items.filter((g) => g.status !== 'archived').length}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
              {CATEGORY_ORDER.filter((c) => counts[c]).map((c) => (
                <Chip key={c} label={`${humanize(c)} ${counts[c]}`} selected={filter === c} onPress={() => setFilter(c)} />
              ))}
            </ChipRow>
          </View>
        }
        ListEmptyComponent={
          <Empty
            title="Start your closet"
            body="Snap each piece on a plain background. WearWise picks out the colours for you."
            action={<Button title="Add your first piece" onPress={() => router.push('/garment/new')} />}
          />
        }
        renderItem={({ item }) => (
          <View style={{ marginBottom: space.md }}>
            <GarmentThumb garment={item} size={size} onPress={() => router.push(`/garment/${item.id}`)} />
            {item.status !== 'available' ? (
              <Body muted style={{ fontSize: 11 }}>{humanize(item.status)}</Body>
            ) : null}
          </View>
        )}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a piece"
        onPress={() => router.push('/garment/new')}
        style={({ pressed }) => [styles.fab, { backgroundColor: t.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <Ionicons name="add" size={30} color={t.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space.lg, paddingBottom: 120 },
  fab: {
    position: 'absolute', right: space.lg, bottom: space.lg, width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
