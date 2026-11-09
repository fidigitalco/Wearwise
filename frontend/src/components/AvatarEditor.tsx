import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SKIN_TONES, type AvatarProfile } from '../lib/avatar';
import { useI18n } from '../lib/i18n';
import { radius, space, type, useTheme } from '../theme';
import { Avatar } from './Avatar';
import { useToast } from './Overlays';
import { Button, Label } from './ui';

/**
 * The avatar at the top of About you & style: the figure, drawn from the
 * height and weight typed below it, plus the two things only the avatar
 * needs, a face photo and a skin tone (both kept on the phone).
 */
export function AvatarEditor({ avatar, heightCm, weightKg, onChange }: {
  avatar: AvatarProfile;
  heightCm: number | null | undefined;
  weightKg: number | null | undefined;
  onChange: (patch: Partial<AvatarProfile>) => void;
}) {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const figure = { ...avatar, heightCm: heightCm || avatar.heightCm, weightKg: weightKg || avatar.weightKg };

  const pickFace = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast(s.avatar.photoDenied, 'error');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true });
    const a = r.canceled ? null : r.assets[0];
    if (a?.base64) onChange({ face: `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` });
  };

  return (
    <View style={[styles.card, { backgroundColor: t.tile }]}>
      <Avatar profile={figure} items={[]} width={110} />
      <View style={{ flex: 1, gap: space.md }}>
        <Text style={[type.title, { color: t.text }]}>{s.avatar.title}</Text>
        <Text style={[type.caption, { color: t.textMuted }]}>{s.avatar.hint}</Text>
        <View style={{ gap: space.xs }}>
          <Label>{s.avatar.face}</Label>
          <View style={styles.row}>
            <Button title={s.avatar.addFace} variant="secondary" size="sm" onPress={pickFace} />
            {avatar.face ? <Button title={s.avatar.removeFace} variant="ghost" size="sm" onPress={() => onChange({ face: null })} /> : null}
          </View>
        </View>
        <View style={{ gap: space.xs }}>
          <Label>{s.avatar.skin}</Label>
          <View style={styles.tones}>
            {SKIN_TONES.map((c, i) => (
              <Pressable key={c} onPress={() => onChange({ skin: c })} accessibilityRole="radio" accessibilityState={{ checked: avatar.skin === c }}
                accessibilityLabel={`${s.avatar.skin} ${i + 1}`}
                style={[styles.tone, { backgroundColor: c, borderColor: avatar.skin === c ? t.primary : t.border, borderWidth: avatar.skin === c ? 3 : 1 }]} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: space.lg, padding: space.lg, borderRadius: radius.lg, alignItems: 'center' },
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  tones: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tone: { width: 28, height: 28, borderRadius: 14 },
});
