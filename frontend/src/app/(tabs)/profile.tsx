import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { Bookmark, ChevronRight, Compass, Crown, Globe, Lock, LogOut, Palette, Ruler, Search, Sparkles, Trash } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { Row, Section } from '../../components/ListRows';
import { BottomSheet, ConfirmationDialog, useToast } from '../../components/Overlays';
import { Chip, ChipWrap } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useI18n, useLabel, type Lang } from '../../lib/i18n';
import { rgbCss, useMeta } from '../../lib/meta';
import { formatPrice, PRICING } from '../../lib/pricing';
import { errorMessage, getStats } from '../../services/api';
import { gutter, space, type, useTheme } from '../../theme';
import type { Stats, User } from '../../types';

const LANGUAGES: { code: Lang; name: string }[] = [
  { code: 'az', name: 'Azərbaycanca' },
  { code: 'en', name: 'English' },
];

/** Profile: who you are as a dresser, a few numbers, the stylist, and settings. */
export default function MyStyleScreen() {
  const t = useTheme();
  const meta = useMeta();
  const toast = useToast();
  const { t: s, lang, setLang } = useI18n();
  const label = useLabel();
  const { user, updateUser, signOut, deleteAccount } = useAuth();
  const premium = user?.plan === 'premium';
  const [stats, setStats] = useState<Stats | null>(null);
  const [name, setName] = useState(user?.display_name ?? '');
  const [sheet, setSheet] = useState<'language' | 'units' | 'privacy' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const guest = !!user?.is_guest;

  useFocusEffect(
    useCallback(() => {
      getStats().then(setStats).catch(() => {});
    }, []),
  );

  const update = async (patch: Partial<User>) => {
    try {
      await updateUser(patch);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const saveName = () => {
    const next = name.trim();
    if (next !== (user?.display_name ?? '')) update({ display_name: next });
  };

  const initial = (user?.display_name || user?.email || '?').charAt(0).toUpperCase();
  const preferred = user?.preferred_styles?.length ? user.preferred_styles : user?.style_direction ? [user.style_direction] : [];
  const topCategory = stats?.most_worn_categories?.[0];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <AppHeader title={s.tabs.settings} />

        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: t.sand }]}>
            <Text style={[type.title, { color: t.text }]}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              value={name}
              onChangeText={setName}
              onEndEditing={saveName}
              onSubmitEditing={saveName}
              placeholder={s.settings.namePlaceholder}
              placeholderTextColor={t.textSecondary}
              accessibilityLabel={s.settings.editName}
              returnKeyType="done"
              style={[type.title, { color: t.text, paddingVertical: 2 }]}
            />
            <Text style={[type.caption, { color: t.textMuted }]}>{guest ? s.guest.label : user?.email}</Text>
          </View>
        </View>

        <View style={[styles.block, { borderTopColor: t.border }]}>
          <Text style={[type.overline, { color: t.textMuted }]}>{s.profile.preferredStyles}</Text>
          <Text style={[type.subtitle, { color: t.text }]}>
            {preferred.length ? preferred.map((x) => label('styles', x)).join(', ') : '–'}
          </Text>
          {user?.favorite_colors?.length ? (
            <View style={styles.swatches}>
              {user.favorite_colors.map((c) => (
                <View key={c} accessibilityLabel={label('colors', c)}
                  style={[styles.swatch, { backgroundColor: rgbCss(meta.colors[c]), borderColor: t.border }]} />
              ))}
            </View>
          ) : null}
          <Pressable onPress={() => router.push('/preferences')} accessibilityRole="button" hitSlop={8}>
            <Text style={[type.bodyStrong, { color: t.primary }]}>{s.profile.edit}</Text>
          </Pressable>
        </View>

        {stats ? (
          <View style={[styles.stats, { borderTopColor: t.border, borderBottomColor: t.border }]}>
            <Stat value={stats.total} label={s.profile.totalItems} />
            <Stat value={stats.worn_outfits ?? 0} label={s.profile.outfitsWorn} />
            {/* "0% worn" reads as a telling-off on a new closet; show what was kept instead until there is a rotation to show. */}
            {stats.rotation_pct > 0
              ? <Stat value={`${stats.rotation_pct}%`} label={s.settings.worn30} />
              : <Stat value={stats.outfits_saved} label={s.profile.savedOutfits} />}
          </View>
        ) : null}
        {topCategory ? (
          <Text style={[type.caption, { color: t.textMuted, marginTop: -space.lg }]}>
            {s.profile.mostWorn}: {label('categories', topCategory.category)}
          </Text>
        ) : null}

        {/* The upgrade pitch waits until the app has shown its worth: a few outfits saved or worn. */}
        {premium || !stats || (stats.outfits_saved ?? 0) + (stats.worn_outfits ?? 0) < 3 ? null : (
          <Pressable onPress={() => router.push('/premium')} accessibilityRole="button"
            style={({ pressed }) => [styles.upgrade, { backgroundColor: t.highlightBg, opacity: pressed ? 0.85 : 1 }]}>
            <View style={[styles.upgradeIcon, { backgroundColor: t.primary }]}>
              <Crown size={20} color={t.onPrimary} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyStrong, { color: t.text }]}>{s.premium.upgrade}</Text>
              <Text style={[type.label, { color: t.textSub }]}>
                {formatPrice(PRICING.monthly)} {s.premium.perMonth} · {formatPrice(PRICING.yearly)} {s.premium.perYear}
              </Text>
            </View>
            <ChevronRight size={18} color={t.text} />
          </Pressable>
        )}

        <Section>
          <Row first icon={<Crown size={20} color={t.primary} strokeWidth={1.6} />} title={s.premium.label}
            value={premium ? s.premium.premiumPlan : s.premium.freePlan} onPress={() => router.push('/premium')} />
          <Row icon={<Sparkles size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.stylist} onPress={() => router.push('/assistant')} />
          <Row icon={<Bookmark size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.saved} onPress={() => router.push('/saved')} />
          <Row icon={<Search size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.search} onPress={() => router.push('/search')} />
          <Row icon={<Compass size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.howItWorks} onPress={() => router.push('/tour')} />
        </Section>

        <Section title={s.profile.settings}>
          <Row first icon={<Palette size={20} color={t.text} strokeWidth={1.6} />} title={s.prefs.title} onPress={() => router.push('/preferences')} />
          <Row icon={<Globe size={20} color={t.text} strokeWidth={1.6} />} title={s.settings.language}
            value={LANGUAGES.find((l) => l.code === lang)?.name} onPress={() => setSheet('language')} />
          <Row icon={<Ruler size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.units}
            value={user?.units === 'imperial' ? s.prefs.imperial : s.prefs.metric} onPress={() => setSheet('units')} />
          <Row icon={<Lock size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.privacy} onPress={() => setSheet('privacy')} />
        </Section>

        <Section title={s.settings.account}>
          <Row first icon={<LogOut size={20} color={t.text} strokeWidth={1.6} />} title={guest ? s.guest.leave : s.settings.signOut}
            onPress={guest ? () => setConfirmLeave(true) : signOut} />
          {guest ? null : (
            <Row icon={<Trash size={20} color={t.danger} strokeWidth={1.6} />} title={s.settings.deleteAccount} onPress={() => setConfirmDelete(true)} danger />
          )}
        </Section>

        <Text style={[type.caption, { color: t.textMuted, textAlign: 'center' }]}>{s.settings.version(Constants.expoConfig?.version ?? '')}</Text>
      </ScrollView>

      <BottomSheet visible={sheet === 'language'} onClose={() => setSheet(null)} title={s.settings.language} closeLabel={s.common.close}>
        <ChipWrap>
          {LANGUAGES.map((l) => (
            <Chip key={l.code} label={l.name} selected={lang === l.code} onPress={() => { setLang(l.code); setSheet(null); }} />
          ))}
        </ChipWrap>
      </BottomSheet>
      <BottomSheet visible={sheet === 'units'} onClose={() => setSheet(null)} title={s.profile.units} closeLabel={s.common.close}>
        <ChipWrap>
          {(['metric', 'imperial'] as const).map((u) => (
            <Chip key={u} label={u === 'metric' ? s.prefs.metric : s.prefs.imperial} selected={(user?.units ?? 'metric') === u}
              onPress={() => { update({ units: u }); setSheet(null); }} />
          ))}
        </ChipWrap>
      </BottomSheet>
      <BottomSheet visible={sheet === 'privacy'} onClose={() => setSheet(null)} title={s.profile.privacy} closeLabel={s.common.close}>
        <Text style={[type.body, { color: t.textSub }]}>{s.profile.privacyBody}</Text>
      </BottomSheet>

      <ConfirmationDialog
        visible={confirmLeave}
        title={s.guest.leaveTitle}
        message={s.guest.leaveBody}
        confirmLabel={s.guest.leave}
        cancelLabel={s.common.cancel}
        destructive
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => { setConfirmLeave(false); signOut(); }}
      />
      <ConfirmationDialog
        visible={confirmDelete}
        title={s.settings.deleteTitle}
        message={s.settings.deleteBody}
        confirmLabel={s.common.delete}
        cancelLabel={s.common.cancel}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); deleteAccount().catch((e) => toast(errorMessage(e), 'error')); }}
      />
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[type.display, { color: t.text, fontSize: 26, lineHeight: 30, fontVariant: ['tabular-nums'] }]}>{value}</Text>
      <Text style={[type.caption, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  upgrade: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: 16 },
  upgradeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wrap: { paddingHorizontal: gutter, paddingTop: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  block: { borderTopWidth: 1, paddingTop: space.lg, gap: space.sm },
  swatches: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginVertical: 2 },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
  stats: { flexDirection: 'row', gap: space.lg, borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: space.lg },
});
