import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Button, Field, IconButton } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { signInWithApple, signInWithGoogle, SocialUnavailable } from '../lib/social';
import { errorMessage } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';

type Busy = 'email' | 'apple' | 'google' | null;

function AppleLogo({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path fill={color} d="M16.37 12.5c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5ZM14.2 6.03c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.68-.92 2.68.97.08 1.96-.49 2.56-1.23Z" />
    </Svg>
  );
}

function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <Path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
      <Path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <Path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </Svg>
  );
}

/** A full-width pill for a sign-in provider: dark (Apple) or outlined (Google). */
function ProviderButton({
  title, icon, dark, loading, disabled, onPress,
}: { title: string; icon: ReactNode; dark?: boolean; loading?: boolean; disabled?: boolean; onPress: () => void }) {
  const t = useTheme();
  const fg = dark ? t.card : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.provider,
        dark ? { backgroundColor: t.text } : { backgroundColor: t.card, borderWidth: 1, borderColor: t.border },
        pressed && { opacity: 0.85 },
        disabled && !loading && { opacity: 0.55 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text style={[type.bodyStrong, { color: fg, fontSize: 16 }]}>{title}</Text>
    </Pressable>
  );
}

export default function AuthScreen() {
  const t = useTheme();
  const { user, signIn, signUp, signInWith } = useAuth();
  const { t: s } = useI18n();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'in' | 'up'>(params.mode === 'in' ? 'in' : 'up');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const up = mode === 'up';

  const submit = async () => {
    setError(null);
    if (up && !name.trim()) {
      setError(s.auth.nameRequired);
      return;
    }
    if (!email.trim() || !password) {
      setError(s.auth.enterBoth);
      return;
    }
    if (up && password.length < 8) {
      setError(s.auth.passwordShort);
      return;
    }
    setBusy('email');
    try {
      if (up) await signUp(email, password, name);
      else await signIn(email, password);
    } catch (e: any) {
      const d = e?.response?.data;
      if (!up && e?.response?.status === 400) setError(s.auth.wrongCredentials);
      else if (d?.display_name) setError(s.auth.nameRequired);
      else if (d?.email) setError(s.auth.emailTaken);
      else if (d?.password) setError(s.auth.passwordWeak);
      else setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const social = async (provider: 'apple' | 'google') => {
    setError(null);
    setBusy(provider);
    try {
      const r = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
      if (r) await signInWith(provider, r.idToken, r.name);
    } catch (e: any) {
      if (e instanceof SocialUnavailable) {
        setError({ expo_go: s.auth.googleExpoGo, not_configured: s.auth.googleNotSetUp, apple_not_configured: s.auth.appleNotSetUp }[e.reason]);
      } else if (e?.response?.data?.code === 'not_configured') {
        setError(s.auth.socialNotSetUp);
      } else {
        setError(e?.response ? errorMessage(e) : s.auth.socialFailed);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.card }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          {router.canGoBack() ? (
            <IconButton icon={<ChevronLeft size={24} color={t.text} />} label={s.common.back} onPress={() => router.back()} style={{ marginLeft: -10 }} />
          ) : null}

          <View style={{ gap: space.sm }}>
            <Text style={[type.display, styles.heading, { color: t.text }]} accessibilityRole="header">
              {up ? s.auth.createAccount : s.auth.welcomeBack}
            </Text>
            <Text style={[type.body, { color: t.textSub }]}>{up ? (user?.is_guest ? s.guest.keep : s.auth.upSub) : s.auth.inSub}</Text>
          </View>

          <View style={{ gap: space.md }}>
            <ProviderButton dark title={s.auth.continueApple} icon={<AppleLogo color={t.card} />} loading={busy === 'apple'}
              disabled={!!busy} onPress={() => social('apple')} />
            <ProviderButton title={s.auth.continueGoogle} icon={<GoogleLogo />} loading={busy === 'google'}
              disabled={!!busy} onPress={() => social('google')} />
          </View>

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: t.border }]} />
            <Text style={[type.label, { color: t.textMuted }]}>{s.auth.orEmail}</Text>
            <View style={[styles.line, { backgroundColor: t.border }]} />
          </View>

          <View style={{ gap: space.md }}>
            {up ? <Field label={s.auth.name} value={name} onChangeText={setName} placeholder={s.auth.namePlaceholder} autoComplete="name" textContentType="name" /> : null}
            <Field
              label={s.auth.email}
              value={email}
              onChangeText={setEmail}
              placeholder="sen@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Field
              label={s.auth.password}
              value={password}
              onChangeText={setPassword}
              placeholder={up ? s.auth.passwordHint : ''}
              secureTextEntry
              autoComplete={up ? 'new-password' : 'current-password'}
              textContentType={up ? 'newPassword' : 'password'}
              onSubmitEditing={submit}
            />
            {error ? <Text style={[type.label, { color: t.danger }]} accessibilityLiveRegion="polite">{error}</Text> : null}
            <Button title={up ? s.auth.createAccount : s.auth.signIn} onPress={submit} loading={busy === 'email'} disabled={!!busy && busy !== 'email'} />
          </View>

          <View style={{ gap: space.sm, alignItems: 'center' }}>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setMode(up ? 'in' : 'up');
                setError(null);
              }}
              style={{ paddingVertical: space.sm }}
            >
              <Text style={[type.body, { color: t.text }]}>
                {up ? s.auth.haveAccount : s.auth.noAccount}{' '}
                <Text style={{ fontWeight: '600', textDecorationLine: 'underline' }}>{up ? s.auth.signIn : s.auth.signUpLink}</Text>
              </Text>
            </Pressable>
            <Text style={[type.caption, { color: t.textMuted, textAlign: 'center' }]}>{s.auth.terms}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.xl },
  heading: { fontSize: 34, lineHeight: 40 },
  provider: { height: 54, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: 1 },
});
