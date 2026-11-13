import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '../components/Overlays';
import { PasswordRules } from '../components/PasswordRules';
import { Button, Field, FormScroll, PasswordField } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { passwordChecks } from '../lib/password';
import { auth, errorMessage } from '../services/api';
import { gutter, space, type, useTheme } from '../theme';

/** Forgot password: email → a 6-digit code by email → a new password, and the person is signed in. */
export default function ForgotPasswordScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const { applySession } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = passwordChecks(password, { email });

  const sendCode = async () => {
    setError(null);
    setBusy(true);
    try {
      await auth.forgotPassword(email.trim().toLowerCase());
      setStep('code');
      toast(s.forgot.sent);
    } catch (e: any) {
      setError(e?.response?.data?.code === 'mail_failed' ? s.forgot.mailFailed : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError(null);
    if (check.failed.length) {
      setError(s.pw.notStrong);
      return;
    }
    setBusy(true);
    try {
      await applySession(await auth.resetPassword(email.trim().toLowerCase(), code.trim(), password));
      toast(s.forgot.done);
      router.replace('/');
    } catch (e: any) {
      const d = e?.response?.data;
      setError(d?.code === 'invalid_code' ? s.forgot.invalidCode : d?.password ? s.pw.notStrong : errorMessage(e));
      setBusy(false);
    }
  };

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <FormScroll style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      {step === 'email' ? (
        <>
          <Text style={[type.body, { color: t.textSub }]}>{s.forgot.intro}</Text>
          <Field label={s.auth.email} value={email} onChangeText={setEmail} placeholder="sen@example.com" autoCapitalize="none"
            autoComplete="email" keyboardType="email-address" textContentType="emailAddress" onSubmitEditing={sendCode} />
          {error ? <Text style={[type.label, { color: t.danger }]} accessibilityLiveRegion="polite">{error}</Text> : null}
          <Button title={s.forgot.send} onPress={sendCode} loading={busy} disabled={!validEmail} />
        </>
      ) : (
        <>
          <Text style={[type.body, { color: t.textSub }]}>{s.forgot.codeIntro(email.trim())}</Text>
          <Field label={s.forgot.code} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="000000"
            keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} />
          <View style={{ gap: space.sm }}>
            <PasswordField label={s.forgot.newPassword} value={password} onChangeText={setPassword}
              autoComplete="new-password" textContentType="newPassword" onSubmitEditing={reset} />
            {password ? <PasswordRules check={check} /> : null}
          </View>
          {error ? <Text style={[type.label, { color: t.danger }]} accessibilityLiveRegion="polite">{error}</Text> : null}
          <Button title={s.forgot.save} onPress={reset} loading={busy} disabled={code.length !== 6 || !password} />
          <View style={styles.links}>
            <Pressable accessibilityRole="button" hitSlop={8} disabled={busy} onPress={sendCode}>
              <Text style={[type.bodyStrong, { color: t.primary }]}>{s.forgot.resend}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => { setStep('email'); setCode(''); setError(null); }}>
              <Text style={[type.bodyStrong, { color: t.primary }]}>{s.forgot.changeEmail}</Text>
            </Pressable>
          </View>
        </>
      )}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.lg, paddingBottom: space.xxl * 2 },
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.md },
});
