import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, ChipWrap, Label } from '../../components/ui';
import { errorMessage, getStats } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { CATEGORY_ORDER, humanize, useMeta } from '../../lib/meta';
import { space, useTheme } from '../../lib/theme';
import type { Stats, User } from '../../lib/types';

export default function ProfileScreen() {
  const t = useTheme();
  const meta = useMeta();
  const { user, updateUser, signOut, deleteAccount } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useFocusEffect(
    useCallback(() => {
      getStats().then(setStats).catch(() => {});
    }, []),
  );

  const update = async (patch: Partial<User>) => {
    try {
      await updateUser(patch);
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e));
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete your account?', 'Your closet, outfits and history are deleted for good.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteAccount().catch((e) => Alert.alert('Could not delete', errorMessage(e))),
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View>
        <Text style={[styles.name, { color: t.text }]}>{user?.display_name || 'Your profile'}</Text>
        <Body muted>{user?.email}</Body>
      </View>

      {stats ? (
        <Card>
          <View style={styles.statsRow}>
            <Stat value={stats.total} label="pieces" />
            <Stat value={`${stats.rotation_pct}%`} label="worn in 30 days" />
            <Stat value={stats.outfits_saved} label="saved looks" />
          </View>
          {stats.never_worn > 0 ? (
            <Body muted>
              {stats.never_worn} {stats.never_worn === 1 ? 'piece has' : 'pieces have'} never been worn. WearWise nudges them into suggestions.
            </Body>
          ) : null}
          <ChipWrap>
            {CATEGORY_ORDER.filter((c) => stats.by_category[c]).map((c) => (
              <Chip key={c} label={`${humanize(c)} ${stats.by_category[c]}`} />
            ))}
          </ChipWrap>
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Label>Your wardrobe</Label>
        <ChipRow>
          {(['womenswear', 'menswear', 'neutral'] as const).map((w) => (
            <Chip key={w} label={humanize(w)} selected={user?.wardrobe_style === w} onPress={() => update({ wardrobe_style: w })} />
          ))}
        </ChipRow>
      </View>

      <View style={{ gap: space.sm }}>
        <Label>Style direction</Label>
        <ChipWrap>
          {meta.style_directions.map((s) => (
            <Chip key={s} label={humanize(s)} selected={user?.style_direction === s} onPress={() => update({ style_direction: s })} />
          ))}
        </ChipWrap>
      </View>

      <View style={{ gap: space.md, marginTop: space.lg }}>
        <Button title="Sign out" variant="secondary" onPress={signOut} />
        <Button title="Delete account" variant="danger" onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: t.text, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: t.textMuted, fontSize: 12, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.xl, paddingBottom: space.xxl },
  name: { fontSize: 26, fontWeight: '800' },
  statsRow: { flexDirection: 'row' },
});
