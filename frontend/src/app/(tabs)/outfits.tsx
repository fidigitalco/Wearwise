import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { OutfitCard } from '../../components/OutfitCard';
import { Button, Chip, ChipRow, Empty } from '../../components/ui';
import { errorMessage, outfits as outfitsApi } from '../../lib/api';
import { space } from '../../lib/theme';
import type { Outfit } from '../../lib/types';

export default function OutfitsScreen() {
  const [tab, setTab] = useState<'saved' | 'history'>('saved');
  const [items, setItems] = useState<Outfit[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await outfitsApi.list(tab === 'saved' ? { saved: true } : undefined));
    } catch {}
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleSave = async (o: Outfit) => {
    try {
      const updated = await outfitsApi.setSaved(o.id, !o.saved);
      setItems((xs) => (tab === 'saved' && !updated.saved ? xs.filter((x) => x.id !== o.id) : xs.map((x) => (x.id === o.id ? updated : x))));
    } catch (e) {
      Alert.alert('Could not update', errorMessage(e));
    }
  };

  const wear = async (o: Outfit) => {
    try {
      await outfitsApi.wear(o.id);
      Alert.alert('Logged', 'Marked as worn today.');
    } catch (e) {
      Alert.alert('Could not log it', errorMessage(e));
    }
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(o) => o.id}
      contentContainerStyle={styles.list}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      ListHeaderComponent={
        <View style={{ gap: space.md }}>
          <Button title="Will it work? Check an outfit" variant="secondary" onPress={() => router.push('/outfit/check')} />
          <ChipRow>
            <Chip label="Saved" selected={tab === 'saved'} onPress={() => setTab('saved')} />
            <Chip label="All suggestions" selected={tab === 'history'} onPress={() => setTab('history')} />
          </ChipRow>
        </View>
      }
      ListEmptyComponent={
        <Empty
          title={tab === 'saved' ? 'No saved outfits yet' : 'No suggestions yet'}
          body={tab === 'saved' ? 'Tap the bookmark on a look you like to keep it here.' : 'Ask for looks on the Today tab.'}
        />
      }
      renderItem={({ item }) => <OutfitCard outfit={item} onToggleSave={() => toggleSave(item)} onWear={() => wear(item)} />}
      ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
});
