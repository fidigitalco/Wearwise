import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useToast } from '../components/Overlays';
import { Button, Chip, ChipWrap, FormScroll } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { errorMessage, sendAppFeedback, type LocalImage } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';

const KINDS = ['idea', 'problem', 'other'] as const;
/** The server keeps at most this many (backend api/views.py, FEEDBACK_MAX_SHOTS). */
const MAX_SHOTS = 3;
const SHOT = 72;

/** Settings → Send feedback: a kind, a message and up to three screenshots, read by staff in the admin panel. */
export default function FeedbackScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const [kind, setKind] = useState<(typeof KINDS)[number]>('idea');
  const [message, setMessage] = useState('');
  const [shots, setShots] = useState<LocalImage[]>([]);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast(s.feedback.shotsDenied, 'error');
      return;
    }
    const room = MAX_SHOTS - shots.length;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: room > 1,
      selectionLimit: room,
      quality: 0.8,
    });
    if (r.canceled) return;
    const picked = r.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName }));
    setShots((prev) => [...prev, ...picked].slice(0, MAX_SHOTS));
  };

  const send = () => {
    setBusy(true);
    sendAppFeedback(
      { kind, message: message.trim(), platform: Platform.OS, app_version: Constants.expoConfig?.version ?? '' },
      shots,
    )
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
        <View style={{ gap: space.sm }}>
          <Text style={[type.overline, { color: t.textMuted }]}>{s.feedback.shots}</Text>
          <Text style={[type.body, { color: t.textMuted, fontSize: 13 }]}>{s.feedback.shotsHint}</Text>
          <View style={styles.shots}>
            {shots.map((img) => (
              <View key={img.uri} style={{ width: SHOT, height: SHOT }}>
                <Image source={{ uri: img.uri }} style={[styles.shot, { backgroundColor: t.card }]} />
                <Pressable
                  onPress={() => setShots((prev) => prev.filter((x) => x.uri !== img.uri))}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={s.feedback.removeShot}
                  style={[styles.remove, { backgroundColor: t.text }]}
                >
                  <X size={13} color={t.bg} />
                </Pressable>
              </View>
            ))}
            {shots.length < MAX_SHOTS && (
              <Pressable
                onPress={pick}
                accessibilityRole="button"
                accessibilityLabel={s.feedback.addShot}
                style={[styles.shot, styles.add, { borderColor: t.border, backgroundColor: t.card }]}
              >
                <ImagePlus size={22} color={t.textMuted} />
              </Pressable>
            )}
          </View>
        </View>
        <Button title={s.feedback.send} onPress={send} loading={busy} disabled={!message.trim() && !shots.length} />
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.xl, paddingBottom: space.xxl * 2 },
  input: { minHeight: 160, borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  shots: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shot: { width: SHOT, height: SHOT, borderRadius: 12 },
  add: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  remove: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
});
