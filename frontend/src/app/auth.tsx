import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button, Field } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { space, useTheme } from '../lib/theme';

export default function AuthScreen() {
  const t = useTheme();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'up' && password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email, password);
      else await signUp(email, password, name);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={{ gap: space.sm }}>
            <Text style={[styles.brand, { color: t.text }]}>WearWise</Text>
            <Body>Your closet, styled for the day ahead: three looks that fit the weather, the occasion and you.</Body>
          </View>

          <View style={{ gap: space.md }}>
            {mode === 'up' ? (
              <Field label="Name" value={name} onChangeText={setName} placeholder="Optional" autoComplete="name" />
            ) : null}
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'up' ? 'At least 8 characters' : ''}
              secureTextEntry
              autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
              textContentType={mode === 'up' ? 'newPassword' : 'password'}
              onSubmitEditing={submit}
            />
            {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
            <Button title={mode === 'in' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />
            <Button
              variant="ghost"
              title={mode === 'in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
              onPress={() => {
                setMode(mode === 'in' ? 'up' : 'in');
                setError(null);
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xxl },
  brand: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
});
