import { Check, X } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { PW_RULES, type passwordChecks } from '../lib/password';
import { space, type, useTheme } from '../theme';

/** The password rules, ticked off live as the person types, then the strength once they all pass. */
export function PasswordRules({ check }: { check: ReturnType<typeof passwordChecks> }) {
  const t = useTheme();
  const { t: s } = useI18n();
  return (
    <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
      {PW_RULES.map((rule) => {
        const bad = check.failed.includes(rule);
        const color = bad ? t.textMuted : t.primary;
        return (
          <View key={rule} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            {bad ? <X size={14} color={color} strokeWidth={2.2} /> : <Check size={14} color={color} strokeWidth={2.2} />}
            <Text style={[type.caption, { color: bad ? t.textSub : t.text }]}>{s.pw.rules[rule]}</Text>
          </View>
        );
      })}
      {check.failed.length === 0 ? (
        <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>
          {s.pw.strengthLabel}: <Text style={{ color: t.text, fontWeight: '600' }}>{s.pw.strength[check.strength]}</Text>
        </Text>
      ) : null}
    </View>
  );
}
