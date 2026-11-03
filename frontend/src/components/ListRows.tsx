import { ChevronRight, CircleCheck, Circle } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, type, useTheme } from '../theme';

/** Grouped list rows in the style of a phone's Settings app: a titled card of rows. */
export function Section({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      {title || hint ? (
        <View style={{ gap: 2, paddingHorizontal: space.xs }}>
          {title ? <Text style={[type.subtitle, { color: t.text }]}>{title}</Text> : null}
          {hint ? <Text style={[type.label, { color: t.textMuted }]}>{hint}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>{children}</View>
    </View>
  );
}

export function Choice({
  title, subtitle, selected, onPress, first,
}: { title: string; subtitle?: string; selected?: boolean; onPress: () => void; first?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: !!selected }}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
        pressed && { backgroundColor: t.cardAlt },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.body, { color: t.text, fontWeight: '500' }]}>{title}</Text>
        {subtitle ? <Text style={[type.caption, { color: t.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {selected ? <CircleCheck size={22} color={t.primary} /> : <Circle size={22} color={t.border} />}
    </Pressable>
  );
}

/**
 * A settings row: icon, title, optional current value or custom right side.
 * Without onPress it renders as plain, non-interactive information.
 */
export function Row({
  icon, title, value, right, onPress, danger, first, disabled,
}: {
  icon: ReactNode;
  title: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  first?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const color = danger ? t.danger : t.text;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
        pressed && onPress && { backgroundColor: t.cardAlt },
        disabled && { opacity: 0.55 },
      ]}
    >
      {icon}
      <Text style={[type.body, { color, flex: 1, fontWeight: '500' }]}>{title}</Text>
      {value ? <Text style={[type.label, { color: t.textMuted }]} numberOfLines={1}>{value}</Text> : null}
      {right}
      {onPress && !right && !danger && !disabled ? <ChevronRight size={18} color={t.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 54, paddingVertical: space.md },
});
