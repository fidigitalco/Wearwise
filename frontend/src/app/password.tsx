import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '../components/Overlays';
import { PasswordRules } from '../components/PasswordRules';
import { Button, FormScroll, PasswordField } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { passwordChecks } from '../lib/password';
import { auth, errorMessage } from '../services/api';
import { gutter, space, type, useTheme } from '../theme';

/**
 * Profile → Password. Changing needs the current password; a Google/Apple-only
 * account sets its first one with just the new password. Either way the server
 * signs out every other device and hands back a fresh session.
 */
export default function PasswordScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const { user, applySession } = useAuth();
  const hasPassword = user?.has_password !== false;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = passwordChecks(next, { email: user?.email, name: user?.display_name });
  const mismatch = !!confirm && confirm !== next;

  const save = async () => {
    if (busy) return;
    setError(null);
    // The button always answers a tap: say what is missing instead of staying greyed out.
    if (hasPassword && !current) return setError(s.password.enterCurrent);
    if (!next) return setError(s.password.enterNew);
    if (check.failed.length) return setError(s.pw.notStrong);
    if (!confirm) return setError(s.password.enterConfirm);
    if (next !== confirm) return setError(s.password.mismatch);
    setBusy(true);
    try {
      await applySession(await auth.changePassword(next, hasPassword ? current : undefined));
      toast(s.password.saved);
      router.back();
    } catch (e: any) {
      const d = e?.response?.data;
      const codes: string[] = Array.isArray(d?.codes) ? d.codes : [];
      setError(
        d?.code === 'wrong_password' ? s.password.wrongCurrent
          : codes.includes('password_too_similar') ? s.password.tooSimilar
          : codes.includes('password_too_common') ? s.password.tooCommon
          : d?.password ? s.pw.notStrong
          : errorMessage(e),
      );
      setBusy(false);
    }
  };

  return (
    <FormScroll style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      {!hasPassword ? <Text style={[type.body, { color: t.textSub }]}>{s.password.setIntro}</Text> : null}
      {hasPassword ? (
        <View style={{ gap: space.sm }}>
          <PasswordField label={s.password.current} value={current} onChangeText={setCurrent}
            autoComplete="current-password" textContentType="password" />
          <Pressable accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-end' }}
            onPress={() => router.push({ pathname: '/forgot-password', params: { email: user?.email ?? '' } })}>
            <Text style={[type.label, { color: t.primary }]}>{s.password.forgot}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={{ gap: space.sm }}>
        <PasswordField label={s.password.new} value={next} onChangeText={setNext} autoComplete="new-password" textContentType="newPassword" />
        {next ? <PasswordRules check={check} /> : null}
      </View>
      <View style={{ gap: space.xs }}>
        <PasswordField label={s.password.confirm} value={confirm} onChangeText={setConfirm}
          autoComplete="new-password" textContentType="newPassword" onSubmitEditing={save} />
        {mismatch ? <Text style={[type.caption, { color: t.danger }]}>{s.password.mismatch}</Text> : null}
      </View>
      {error ? <Text style={[type.label, { color: t.danger }]} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button title={s.password.save} onPress={save} loading={busy} />
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.lg, paddingBottom: space.xxl * 2 },
});
