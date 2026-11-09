import { CircleAlert, Eye, EyeOff, Search, X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useI18n } from '../lib/i18n';
import { elevation, radius, space, touch, type, useTheme } from '../theme';

// ── Forms ───────────────────────────────────────────────────────────────────

/**
 * A scrolling form that keeps the focused field and the buttons below it
 * reachable with the keyboard open. iOS insets the scroll view by the
 * keyboard itself, which also holds inside modal screens, where a padding
 * KeyboardAvoidingView misses the header height and hides the Save button.
 * Android shrinks the view to the space above the keyboard.
 */
export function FormScroll({ children, contentContainerStyle, style }: {
  children: ReactNode; contentContainerStyle?: StyleProp<ViewStyle>; style?: StyleProp<ViewStyle>;
}) {
  const scroll = (
    <ScrollView
      style={Platform.OS === 'ios' ? style : undefined}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  );
  return Platform.OS === 'ios' ? scroll : <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior="height">{scroll}</KeyboardAvoidingView>;
}

// ── Buttons ─────────────────────────────────────────────────────────────────

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
};

export function Button({ title, onPress, variant = 'primary', size = 'md', loading, disabled, style, icon }: ButtonProps) {
  const t = useTheme();
  const bg = { primary: t.primary, secondary: t.card, ghost: 'transparent', danger: 'transparent' }[variant];
  const fg = { primary: t.onPrimary, secondary: t.text, ghost: t.primary, danger: t.danger }[variant];
  const border = { primary: t.primary, secondary: t.border, ghost: 'transparent', danger: t.danger }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        {
          backgroundColor: pressed && variant === 'primary' ? t.primaryPressed : pressed && variant !== 'ghost' ? t.bg : bg,
          borderColor: pressed && variant === 'primary' ? t.primaryPressed : border,
          opacity: off ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[size === 'sm' ? type.label : type.bodyStrong, { color: fg, fontWeight: '600' }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export const PrimaryButton = (p: Omit<ButtonProps, 'variant'>) => <Button {...p} variant="primary" />;
export const SecondaryButton = (p: Omit<ButtonProps, 'variant'>) => <Button {...p} variant="secondary" />;

/** A round, icon-only button with an accessible label and a 44pt target. */
export function IconButton({
  icon, label, onPress, active, tone = 'plain', style,
}: {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  active?: boolean;
  tone?: 'plain' | 'filled' | 'overlay';
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = tone === 'filled' ? (active ? t.highlightBg : t.cardAlt) : tone === 'overlay' ? t.frosted : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active !== undefined ? { selected: active } : undefined}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }, style]}
    >
      {icon}
    </Pressable>
  );
}

// ── Chips ───────────────────────────────────────────────────────────────────

export function Chip({
  label, selected, onPress, swatch, icon,
}: { label: string; selected?: boolean; onPress?: () => void; swatch?: string; icon?: ReactNode }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? t.primary : t.card, borderColor: selected ? t.primary : t.border },
      ]}
    >
      {icon}
      {swatch ? <View style={[styles.swatch, { backgroundColor: swatch, borderColor: t.border }]} /> : null}
      <Text style={[type.label, { color: selected ? t.onPrimary : t.text, fontWeight: selected ? '600' : '500' }]}>{label}</Text>
    </Pressable>
  );
}

export const FilterChip = Chip;

export function ChipRow({ children, inset = 0 }: { children: ReactNode; inset?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chipRow, { paddingHorizontal: inset }]}
      style={inset ? { marginHorizontal: -inset } : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function ChipWrap({ children }: { children: ReactNode }) {
  return <View style={[styles.chipRow, { flexWrap: 'wrap' }]}>{children}</View>;
}

// ── Surfaces and text ───────────────────────────────────────────────────────

export function Card({ children, style, raised }: { children: ReactNode; style?: StyleProp<ViewStyle>; raised?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, raised && elevation(t), style]}>{children}</View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[type.overline, { color: t.textMuted }]}>{children}</Text>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[type.title, { color: t.text }, style]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[type.body, { color: muted ? t.textMuted : t.textSub }, style]}>{children}</Text>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[type.title, { color: t.text, flex: 1 }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={[type.label, { color: t.primary, fontWeight: '600' }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Inputs ──────────────────────────────────────────────────────────────────

export function Field(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text style={[type.label, { color: t.textSub }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.textMuted}
        {...rest}
        style={[styles.input, type.body, { color: t.text, backgroundColor: t.card, borderColor: t.border }, style]}
      />
    </View>
  );
}

/** A password field with an eye button that shows or hides what was typed. */
export function PasswordField(props: Omit<TextInputProps, 'secureTextEntry'> & { label?: string }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const [shown, setShown] = useState(false);
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text style={[type.label, { color: t.textSub }]}>{label}</Text> : null}
      <View>
        <TextInput
          placeholderTextColor={t.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
          secureTextEntry={!shown}
          style={[styles.input, type.body, { color: t.text, backgroundColor: t.card, borderColor: t.border, paddingRight: 48 }, style]}
        />
        <Pressable
          onPress={() => setShown((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={shown ? s.common.hidePassword : s.common.showPassword}
          hitSlop={8}
          style={styles.eye}
        >
          {shown ? <EyeOff size={20} color={t.textSecondary} /> : <Eye size={20} color={t.textSecondary} />}
        </Pressable>
      </View>
    </View>
  );
}

export function SearchField({
  value, onChangeText, placeholder, autoFocus, onSubmit,
}: { value: string; onChangeText: (v: string) => void; placeholder: string; autoFocus?: boolean; onSubmit?: () => void }) {
  const t = useTheme();
  const { t: s } = useI18n();
  return (
    <View style={[styles.search, { backgroundColor: t.card, borderColor: t.border }]}>
      <Search size={18} color={t.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        accessibilityLabel={placeholder}
        style={[type.body, { flex: 1, color: t.text, paddingVertical: 0 }]}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={s.common.clear}>
          <X size={18} color={t.textMuted} />
        </Pressable>
      ) : null}
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
            hitSlop={{ top: 14, bottom: 14 }}
            style={[styles.step, { backgroundColor: s <= value ? t.highlight : t.cardAlt }]}
          />
        ))}
      </View>
      {labels ? <Text style={[type.label, { color: t.textSub }]}>{labels[value]}</Text> : null}
    </View>
  );
}

// ── Scores ──────────────────────────────────────────────────────────────────

/** The look's overall score as quiet text ("86% match"), never a coloured badge. */
export function CompatibilityScore({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const v = Math.round(value);
  return (
    <Text accessibilityLabel={`${s.common.matchWord(v)}, ${s.common.match(v)}`}
      style={[size === 'sm' ? type.caption : type.label, { color: t.primary, fontWeight: '600' }]}>
      {s.common.matchWord(v)}
    </Text>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }) {
  const t = useTheme();
  return (
    <View style={styles.scoreRow}>
      <Text style={[type.label, { width: 96, color: t.textSub }]}>{label}</Text>
      <View style={[styles.scoreTrack, { backgroundColor: t.cardAlt }]}>
        <View style={[styles.scoreFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: t.primary }]} />
      </View>
      <Text style={[type.label, { width: 30, textAlign: 'right', color: t.text, fontVariant: ['tabular-nums'] }]}>{Math.round(value)}</Text>
    </View>
  );
}

// ── States ──────────────────────────────────────────────────────────────────

export function EmptyState({
  title, body, action, illustration,
}: { title: string; body?: string; action?: ReactNode; illustration?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      {illustration ? <View style={styles.illustration}>{illustration}</View> : null}
      <Text style={[type.title, { color: t.text, textAlign: 'center' }]}>{title}</Text>
      {body ? <Body muted style={{ textAlign: 'center' }}>{body}</Body> : null}
      {action}
    </View>
  );
}

export const Empty = EmptyState;

export function ErrorState({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <CircleAlert size={28} color={t.danger} />
      <Body style={{ textAlign: 'center' }}>{message}</Body>
      {onRetry && retryLabel ? <Button title={retryLabel} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

/** A pulsing placeholder block while content loads. */
export function LoadingSkeleton({ width, height, radius: r = radius.md, style }: {
  width?: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ width: width ?? '100%', height, borderRadius: r, backgroundColor: t.cardAlt, opacity: pulse }, style]} />;
}

const styles = StyleSheet.create({
  eye: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  button: {
    minHeight: 48, borderRadius: radius.md, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  buttonSm: { minHeight: 38, paddingHorizontal: space.md, borderRadius: radius.sm },
  iconButton: { width: touch, height: touch, borderRadius: touch / 2, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 34,
    borderRadius: radius.pill, borderWidth: 1,
  },
  chipRow: { flexDirection: 'row', gap: space.sm, paddingVertical: 2 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 46, borderRadius: radius.md,
    borderWidth: 1, paddingHorizontal: space.md,
  },
  step: { flex: 1, height: 10, borderRadius: 5 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  scoreTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  scoreFill: { height: 4, borderRadius: 2 },
  empty: { alignItems: 'center', gap: space.md, padding: space.xl },
  illustration: { alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
});
