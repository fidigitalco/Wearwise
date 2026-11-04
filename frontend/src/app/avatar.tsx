import * as ImagePicker from 'expo-image-picker';
import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Overlays';
import { Button, Label } from '../components/ui';
import { DEFAULT_AVATAR, loadAvatar, saveAvatar, SKIN_TONES, type AvatarProfile } from '../lib/avatar';
import { useI18n } from '../lib/i18n';
import { gutter, radius, space, type, useTheme } from '../theme';

/** The avatar's face, skin tone, height and weight (prototype spec §2.3). Saved as it changes, on the phone only. */
export default function AvatarScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const toast = useToast();
  const [p, setP] = useState<AvatarProfile>(DEFAULT_AVATAR);

  useEffect(() => {
    loadAvatar().then(setP);
  }, []);

  const update = (patch: Partial<AvatarProfile>) => {
    setP((cur) => {
      const next = { ...cur, ...patch };
      saveAvatar(next);
      return next;
    });
  };

  const pickFace = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast(s.avatar.photoDenied, 'error');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true });
    const a = r.canceled ? null : r.assets[0];
    if (a?.base64) update({ face: `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` });
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      <View style={[styles.stage, { backgroundColor: t.tile }]}>
        <Avatar profile={p} items={[]} width={150} />
      </View>
      <Text style={[type.caption, { color: t.textMuted }]}>{s.avatar.hint}</Text>

      <View style={{ gap: space.sm }}>
        <Label>{s.avatar.face}</Label>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button title={s.avatar.addFace} variant="secondary" size="sm" onPress={pickFace} />
          {p.face ? <Button title={s.avatar.removeFace} variant="ghost" size="sm" onPress={() => update({ face: null })} /> : null}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <Label>{s.avatar.skin}</Label>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {SKIN_TONES.map((c) => (
            <Pressable key={c} onPress={() => update({ skin: c })} accessibilityRole="radio" accessibilityState={{ checked: p.skin === c }}
              accessibilityLabel={`${s.avatar.skin} ${SKIN_TONES.indexOf(c) + 1}`}
              style={[styles.tone, { backgroundColor: c, borderColor: p.skin === c ? t.primary : t.border, borderWidth: p.skin === c ? 3 : 1 }]} />
          ))}
        </View>
      </View>

      <Measure label={s.avatar.height} value={p.heightCm} unit="cm" min={140} max={210} step={1} onChange={(heightCm) => update({ heightCm })} />
      <Measure label={s.avatar.weight} value={p.weightKg} unit="kg" min={40} max={150} step={1} onChange={(weightKg) => update({ weightKg })} />
    </ScrollView>
  );
}

function Measure({ label, value, unit, min, max, step, onChange }: {
  label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  const t = useTheme();
  const btn = (icon: React.ReactNode, next: number, a11y: string) => (
    <Pressable onPress={() => onChange(Math.max(min, Math.min(max, next)))} accessibilityRole="button" accessibilityLabel={a11y}
      hitSlop={6} style={({ pressed }) => [styles.btn, { borderColor: t.border, backgroundColor: pressed ? t.cardAlt : t.card }]}>
      {icon}
    </Pressable>
  );
  return (
    <View style={styles.measure}>
      <Text style={[type.body, { color: t.text, flex: 1, fontWeight: '500' }]}>{label}</Text>
      {btn(<Minus size={18} color={t.text} />, value - step, `${label} −`)}
      <Text style={[type.bodyStrong, { color: t.text, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] }]}>{value} {unit}</Text>
      {btn(<Plus size={18} color={t.text} />, value + step, `${label} +`)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.xl, paddingBottom: space.xxl * 2 },
  stage: { alignItems: 'center', borderRadius: radius.lg, paddingVertical: space.lg },
  tone: { width: 38, height: 38, borderRadius: 19 },
  measure: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  btn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
