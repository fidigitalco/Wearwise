import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LOCALES, useI18n } from '../lib/i18n';
import { radius, space, type, useTheme } from '../theme';

/** YYYY-MM-DD in local time. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Wednesday, 12 November 2026" in the app's language. */
export function longDate(iso: string, locale: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * A month grid to pick a day: weeks start on Monday, today is ringed, past
 * days are greyed out and cannot be picked.
 */
export function MonthPicker({ value, onChange }: { value: string | null; onChange: (iso: string) => void }) {
  const t = useTheme();
  const { lang } = useI18n();
  const locale = LOCALES[lang];
  const today = isoDay(new Date());
  const start = value ? new Date(`${value}T12:00:00`) : new Date();
  const [month, setMonth] = useState(new Date(start.getFullYear(), start.getMonth(), 1));

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  // Weekday initials from a known Monday, in the app's language.
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }));
  const canGoBack = month > new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <Pressable onPress={() => canGoBack && setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} hitSlop={10}
          accessibilityRole="button" disabled={!canGoBack} style={{ opacity: canGoBack ? 1 : 0.3 }}>
          <ChevronLeft size={20} color={t.text} />
        </Pressable>
        <Text style={[type.bodyStrong, { color: t.text, textTransform: 'capitalize' }]}>
          {month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} hitSlop={10} accessibilityRole="button">
          <ChevronRight size={20} color={t.text} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {weekdays.map((w) => <Text key={w} style={[type.caption, styles.cell, { color: t.textMuted, textTransform: 'capitalize' }]}>{w.slice(0, 2)}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.row}>
          {cells.slice(r * 7, r * 7 + 7).map((n, i) => {
            if (!n) return <View key={i} style={styles.cell} />;
            const iso = isoDay(new Date(month.getFullYear(), month.getMonth(), n));
            const past = iso < today;
            const on = iso === value;
            return (
              <Pressable key={i} disabled={past} onPress={() => onChange(iso)} accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: past }} accessibilityLabel={longDate(iso, locale)} style={styles.cell}>
                <View style={[styles.day, on && { backgroundColor: t.primary }, iso === today && !on && { borderWidth: 1.5, borderColor: t.primary }]}>
                  <Text style={[type.label, { color: on ? t.onPrimary : past ? t.border : t.text, fontWeight: on ? '700' : '500' }]}>{n}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', textAlign: 'center', paddingVertical: 2 },
  day: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
