import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useToast } from '../components/Overlays';
import { Button, Chip, ChipWrap, FormScroll } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { errorMessage, sendAppFeedback } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';

const KINDS = ['idea', 'problem', 'other'] as const;

/** Settings → Send feedback: a kind and a message, read by staff in the admin panel. */
export default function FeedbackScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const [kind, setKind] = useState<(typeof KINDS)[number]>('idea');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const send = () => {
    setBusy(true);
    sendAppFeedback({ kind, message: message.trim(), platform: Platform.OS, app_version: Constants.expoConfig?.version ?? '' })
      .then(() => {
        toast(s.feedback.sent);
        router.back();
      })
      .catch((e) => {
        toast(errorMessage(e), 'error');
        setBusy(false);
      });
  };

  return (
    <FormScroll style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
        <Text style={[type.body, { color: t.textSub }]}>{s.feedback.intro}</Text>
        <View style={{ gap: space.sm }}>
          <Text style={[type.overline, { color: t.textMuted }]}>{s.feedback.kind}</Text>
          <ChipWrap>
            {KINDS.map((k) => (
              <Chip key={k} label={s.feedback.kinds[k]} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </ChipWrap>
        </View>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder={s.feedback.placeholder}
          placeholderTextColor={t.textMuted}
          accessibilityLabel={s.feedback.title}
          multiline
          maxLength={4000}
          textAlignVertical="top"
          style={[type.body, styles.input, { color: t.text, backgroundColor: t.card, borderColor: t.border }]}
        />
        <Button title={s.feedback.send} onPress={send} loading={busy} disabled={!message.trim()} />
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.xl, paddingBottom: space.xxl * 2 },
  input: { minHeight: 160, borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
});
