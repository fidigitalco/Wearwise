import Constants from 'expo-constants';
import { router } from 'expo-router';
import { BellRing, Bookmark, ImagePlus, CircleUserRound, Heart, Layers, Shirt, Compass, Crown, Globe, Lock, LogOut, MessageSquare, ShoppingBag, Sparkles, Star, Thermometer, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { Choice, Row, Section } from '../../components/ListRows';
import { BottomSheet, ConfirmationDialog, useToast } from '../../components/Overlays';
import { useAuth } from '../../lib/auth';
import { LANGUAGES, useI18n, useLabel } from '../../lib/i18n';
import { rgbCss, useMeta } from '../../lib/meta';
import { openStoreReview } from '../../lib/rate';
import { errorMessage } from '../../services/api';
import { gutter, space, type, useTheme } from '../../theme';
import type { User } from '../../types';

/** Profile: who you are as a dresser, a few numbers, the stylist, and settings. */
export default function MyStyleScreen() {
  const t = useTheme();
  const meta = useMeta();
  const toast = useToast();
  const { t: s, lang, setLang } = useI18n();
  const label = useLabel();
  const { user, updateUser, signOut, deleteAccount } = useAuth();
  const premium = user?.plan === 'premium';
  const [name, setName] = useState(user?.display_name ?? '');
  const [sheet, setSheet] = useState<'language' | 'units' | 'privacy' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const guest = !!user?.is_guest;


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
  const tags = [
    ...(user?.preferred_styles ?? []).map((x) => label('styles', x)),
    ...(user?.budget_ranges ?? []).map((b) => s.onb.budgets[b]),
    user?.sizes?.top ? `${s.onb.tops} ${user.sizes.top}` : null,
    user?.sizes?.bottom ? `${user.gender === 'male' ? 'W' : 'EU'} ${user.sizes.bottom}` : null,
    user?.sizes?.shoes ? `${s.onb.shoes} ${user.sizes.shoes}` : null,
    user?.fit_preference ? label('fits', user.fit_preference) : null,
    user?.country ? s.onb.countries[user.country] : null,
  ].filter(Boolean) as string[];

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

        {/* The style profile in short: what Discovery, dates and checks are tuned to. */}
        <View style={[styles.block, { borderTopColor: t.border }]}>
          <Text style={[type.overline, { color: t.textMuted }]}>{s.me.styleTitle}</Text>
          {!user?.age_range ? (
            <Pressable onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })} accessibilityRole="button"
              style={({ pressed }) => [styles.setup, { backgroundColor: t.highlightBg, opacity: pressed ? 0.85 : 1 }]}>
              <Text style={[type.bodyStrong, { color: t.text }]}>{s.me.setupTitle}</Text>
              <Text style={[type.caption, { color: t.textSub }]}>{s.me.setupSub}</Text>
            </Pressable>
          ) : tags.length ? (
            <View style={styles.tags}>
              {tags.map((x) => (
                <View key={x} style={[styles.tag, { backgroundColor: t.cardAlt }]}>
                  <Text style={[type.caption, { color: t.text }]}>{x}</Text>
                </View>
              ))}
            </View>
          ) : <Text style={[type.body, { color: t.textMuted }]}>{s.me.noTags}</Text>}
          {user?.favorite_colors?.length ? (
            <View style={styles.swatches}>
              {user.favorite_colors.map((c) => (
                <View key={c} accessibilityLabel={label('colors', c)}
                  style={[styles.swatch, { backgroundColor: rgbCss(meta.colors[c]), borderColor: t.border }]} />
              ))}
            </View>
          ) : null}
          <Pressable onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })} accessibilityRole="button" hitSlop={8}>
            <Text style={[type.bodyStrong, { color: t.primary }]}>{s.me.editStyle}</Text>
          </Pressable>
        </View>

        <Section>
          <Row first icon={<Crown size={20} color={t.primary} strokeWidth={1.6} />} title={s.premium.label}
            value={premium ? s.premium.premiumPlan : s.premium.freePlan} onPress={() => router.push('/premium')} />
          <Row icon={<Heart size={20} color={t.text} strokeWidth={1.6} />} title={s.wishlist.title} onPress={() => router.push('/wishlist')} />
          <Row icon={<BellRing size={20} color={t.text} strokeWidth={1.6} />} title={s.me.priceAlerts} onPress={() => router.push('/wishlist')} />
          <Row icon={<ImagePlus size={20} color={t.text} strokeWidth={1.6} />} title={s.inspo.title} onPress={() => router.push('/inspiration')} />
          <Row icon={<Sparkles size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.stylist} onPress={() => router.push('/assistant')} />
          <Row icon={<Compass size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.howItWorks} onPress={() => router.push('/tour')} />
        </Section>

        {/* Out of the MVP but kept: the closet and its outfits for those who already built one. */}
        <Section>
          <Row first icon={<Shirt size={20} color={t.text} strokeWidth={1.6} />} title={s.me.myCloset} onPress={() => router.push('/closet')} />
          <Row icon={<Layers size={20} color={t.text} strokeWidth={1.6} />} title={s.me.myOutfits} onPress={() => router.push('/outfits')} />
          <Row icon={<Bookmark size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.saved} onPress={() => router.push('/saved')} />
          <Row icon={<ShoppingBag size={20} color={t.text} strokeWidth={1.6} />} title={s.shop.screen} onPress={() => router.push('/shop')} />
        </Section>

        <Section title={s.profile.settings}>
          <Row first icon={<CircleUserRound size={20} color={t.text} strokeWidth={1.6} />} title={s.prefs.title} onPress={() => router.push('/preferences')} />
          <Row icon={<Globe size={20} color={t.text} strokeWidth={1.6} />} title={s.settings.language}
            value={LANGUAGES.find((l) => l.code === lang)?.name} onPress={() => setSheet('language')} />
          <Row icon={<Thermometer size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.units}
            value={user?.units === 'imperial' ? s.prefs.imperial : s.prefs.metric} onPress={() => setSheet('units')} />
          <Row icon={<Lock size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.privacy} onPress={() => setSheet('privacy')} />
        </Section>

        <Section title={s.profile.support}>
          <Row first icon={<MessageSquare size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.feedback} onPress={() => router.push('/feedback')} />
          <Row icon={<Star size={20} color={t.text} strokeWidth={1.6} />} title={s.profile.rate}
            onPress={() => openStoreReview().then((opened) => { if (!opened) toast(s.profile.rateSoon); }).catch((e) => toast(errorMessage(e), 'error'))} />
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
        <Section>
          {LANGUAGES.map((l, i) => (
            <Choice key={l.code} first={i === 0} title={l.name} selected={lang === l.code} onPress={() => { setLang(l.code); setSheet(null); }} />
          ))}
        </Section>
      </BottomSheet>
      <BottomSheet visible={sheet === 'units'} onClose={() => setSheet(null)} title={s.profile.units} closeLabel={s.common.close}>
        <Section>
          {(['metric', 'imperial'] as const).map((u, i) => (
            <Choice key={u} first={i === 0} title={u === 'metric' ? s.prefs.metric : s.prefs.imperial} selected={(user?.units ?? 'metric') === u}
              onPress={() => { update({ units: u }); setSheet(null); }} />
          ))}
        </Section>
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

const styles = StyleSheet.create({
  upgrade: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: 16 },
  upgradeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wrap: { paddingHorizontal: gutter, paddingTop: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  block: { borderTopWidth: 1, paddingTop: space.lg, gap: space.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  setup: { padding: space.md, borderRadius: 16, gap: 4 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  swatches: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginVertical: 2 },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
});
