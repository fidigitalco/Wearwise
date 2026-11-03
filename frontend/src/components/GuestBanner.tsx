import { router } from 'expo-router';
import { UserRound } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { radius, space, type, useTheme } from '../theme';
import { Button } from './ui';

/** Shown to guests: they are looking around, and signing up keeps what they did. Renders nothing for members. */
export function GuestBanner() {
  const t = useTheme();
  const { t: s } = useI18n();
  const { user } = useAuth();
  if (!user?.is_guest) return null;
  return (
    <View style={[styles.banner, { backgroundColor: t.highlightBg }]}>
      <UserRound size={20} color={t.primary} strokeWidth={1.8} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: t.text }]}>{s.guest.bannerTitle}</Text>
        <Text style={[type.caption, { color: t.textSub }]}>{s.guest.bannerBody}</Text>
      </View>
      <Button size="sm" title={s.guest.signUp} onPress={() => router.push({ pathname: '/auth', params: { mode: 'up' } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingLeft: space.lg, borderRadius: radius.lg },
});
