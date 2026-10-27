import { type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { radius, space, useTheme } from '../lib/theme';

export function Button({
  title, onPress, variant = 'primary', loading, disabled, style, icon,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
}) {
  const t = useTheme();
  const bg = { primary: t.primary, secondary: t.cardAlt, ghost: 'transparent', danger: 'transparent' }[variant];
  const fg = { primary: t.onPrimary, secondary: t.text, ghost: t.text, danger: t.danger }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'danger' && { borderWidth: 1, borderColor: t.danger },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Chip({
  label, selected, onPress, swatch,
}: { label: string; selected?: boolean; onPress?: () => void; swatch?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? t.primary : t.card, borderColor: selected ? t.primary : t.border },
      ]}
    >
      {swatch ? <View style={[styles.swatch, { backgroundColor: swatch, borderColor: t.border }]} /> : null}
      <Text style={[styles.chipText, { color: selected ? t.onPrimary : t.text }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {children}
    </ScrollView>
  );
}

export function ChipWrap({ children }: { children: ReactNode }) {
  return <View style={[styles.chipRow, { flexWrap: 'wrap' }]}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.label, { color: t.textMuted }]}>{children}</Text>;
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.title, { color: t.text }]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: any }) {
  const t = useTheme();
  return <Text style={[styles.body, { color: muted ? t.textMuted : t.textSub }, style]}>{children}</Text>;
}

export function Field(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={t.textMuted}
        {...rest}
        style={[styles.input, { color: t.text, backgroundColor: t.card, borderColor: t.border }, style]}
      />
    </View>
  );
}

/** A 1–5 (or 0–5) step selector with a word for the current value. */
export function Stepper({
  value, min, max, onChange, labels,
}: { value: number; min: number; max: number; onChange: (v: number) => void; labels?: string[] }) {
  const t = useTheme();
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.row}>
        {steps.map((s) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={labels?.[s] ?? String(s)}
            accessibilityState={{ selected: s === value }}
            onPress={() => onChange(s)}
            style={[styles.step, { backgroundColor: s <= value ? t.highlight : t.cardAlt }]}
          />
        ))}
      </View>
      {labels ? <Text style={[styles.body, { color: t.textSub }]}>{labels[value]}</Text> : null}
    </View>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }) {
  const t = useTheme();
  return (
    <View style={styles.scoreRow}>
      <Text style={[styles.scoreLabel, { color: t.textSub }]}>{label}</Text>
      <View style={[styles.scoreTrack, { backgroundColor: t.cardAlt }]}>
        <View style={[styles.scoreFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: t.highlight }]} />
      </View>
      <Text style={[styles.scoreValue, { color: t.text }]}>{Math.round(value)}</Text>
    </View>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Title>{title}</Title>
      {body ? <Body muted style={{ textAlign: 'center' }}>{body}</Body> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  button: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 36,
    borderRadius: radius.pill, borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  chipRow: { flexDirection: 'row', gap: space.sm, paddingVertical: 2 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16 },
  step: { flex: 1, height: 10, borderRadius: 5 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  scoreLabel: { width: 88, fontSize: 13 },
  scoreTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  scoreFill: { height: 6, borderRadius: 3 },
  scoreValue: { width: 28, textAlign: 'right', fontSize: 13, fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', gap: space.md, padding: space.xxl },
});
