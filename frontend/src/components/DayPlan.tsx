import { CalendarCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n, useLabel } from '../lib/i18n';
import { useMeta } from '../lib/meta';
import { readPlan } from '../services/api';
import { radius, space, type, useTheme } from '../theme';
import { Chip, ChipRow } from './ui';

// How dressed-up each occasion reads; the server's OCCASION_LEVEL.
const LEVEL: Record<string, string> = {
  formal: 'formal', client_meeting: 'formal', work: 'formal', date: 'smart', party: 'smart',
  casual: 'casual', sport: 'casual', travel: 'casual',
};

/**
 * "Today's plan" in the user's own words (prototype spec §2.1, §3.5): the
 * server reads an occasion from it ("client meeting, dinner after" → formal)
 * and the suggestion follows. The occasion can still be changed by hand.
 */
export function DayPlan({ occasion, onOccasion, inset }: { occasion: string; onOccasion: (o: string) => void; inset: number }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const meta = useMeta();
  const [text, setText] = useState('');
  const [reading, setReading] = useState<{ occasion: string | null } | null>(null);
  const [picking, setPicking] = useState(false);

  const submit = () => {
    const plan = text.trim();
    if (!plan) return;
    readPlan(plan)
      .then((r) => {
        setReading(r);
        setPicking(!r.occasion);
        if (r.occasion) onOccasion(r.occasion);
      })
      .catch(() => setPicking(true));
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={[styles.field, { backgroundColor: t.card, borderColor: t.border }]}>
        <CalendarCheck size={18} color={t.textSecondary} strokeWidth={1.6} />
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder={s.plan.placeholder}
          placeholderTextColor={t.textMuted}
          accessibilityLabel={s.plan.label}
          returnKeyType="done"
          maxLength={200}
          style={[type.body, { flex: 1, color: t.text, paddingVertical: space.sm }]}
        />
      </View>
      {reading?.occasion && !picking ? (
        <Text style={[type.caption, { color: t.textMuted }]}>
          {s.plan.read(s.plan.levels[LEVEL[occasion] ?? 'smart'], label('occasions', occasion))}
          {'  '}
          <Text style={{ color: t.primary, fontWeight: '600' }} onPress={() => setPicking(true)} accessibilityRole="button">{s.plan.change}</Text>
        </Text>
      ) : null}
      {picking ? (
        <View style={{ gap: space.xs }}>
          {!reading?.occasion ? <Text style={[type.caption, { color: t.textMuted }]}>{s.plan.unknown}</Text> : null}
          <ChipRow inset={inset}>
            {Object.keys(meta.occasions).map((o) => (
              <Chip key={o} label={label('occasions', o)} selected={occasion === o} onPress={() => { onOccasion(o); setPicking(false); setReading((r) => r && { ...r, occasion: o }); }} />
            ))}
          </ChipRow>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
});
