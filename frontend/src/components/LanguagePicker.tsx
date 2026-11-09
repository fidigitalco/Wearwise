import { Globe } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LANGUAGES, useI18n } from '../lib/i18n';
import { radius, space, useTheme } from '../theme';
import { Choice, Section } from './ListRows';
import { BottomSheet } from './Overlays';

/** The app's language before sign-in: a small globe button that opens the list of languages. */
export function LanguagePicker() {
  const t = useTheme();
  const { t: s, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${s.settings.language}: ${current?.name ?? ''}`}
        hitSlop={6} style={({ pressed }) => [styles.button, { borderColor: t.border, backgroundColor: pressed ? t.cardAlt : t.card }]}>
        <Globe size={16} color={t.text} strokeWidth={1.8} />
        <Text style={{ color: t.text, fontWeight: '600', fontSize: 13 }}>{current?.name}</Text>
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={s.settings.language} closeLabel={s.common.close}>
        <Section>
          {LANGUAGES.map((l, i) => (
            <Choice key={l.code} first={i === 0} title={l.name} selected={lang === l.code} onPress={() => { setLang(l.code); setOpen(false); }} />
          ))}
        </Section>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
});
