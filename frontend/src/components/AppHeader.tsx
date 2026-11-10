import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { CalendarDays, ScanSearch, Sparkles, Sun, UserRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { elevation, space, type, useTheme } from '../theme';

/** Large editorial page title with optional subtitle and trailing actions. */
export function AppHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 2 }}>
        {subtitle ? <Text style={[type.label, { color: t.textMuted }]}>{subtitle}</Text> : null}
        <Text style={[type.display, { color: t.text }]} accessibilityRole="header">{title}</Text>
      </View>
      {right ? <View style={styles.actions}>{right}</View> : null}
    </View>
  );
}

const TAB_ICONS: Record<string, typeof Sun> = {
  index: Sun,
  discover: Sparkles,
  stylist: ScanSearch,
  dates: CalendarDays,
  profile: UserRound,
};

/**
 * A floating, frosted panel above the home indicator. The active tab sits on
 * a soft pill with a bolder icon and a small terracotta dot under its label.
 * Hidden routes (href: null) are skipped.
 */
export function BottomTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const t = useTheme();
  return (
    <View style={[styles.barWrap, { backgroundColor: t.bg, paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      <View style={[styles.bar, { backgroundColor: t.glass, borderColor: t.card }, elevation(t, 2)]}>
        {state.routes.map((route, i) => {
          if (!TAB_ICONS[route.name]) return null;
          const { options } = descriptors[route.key];
          const focused = state.index === i;
          const Icon = TAB_ICONS[route.name];
          const color = focused ? t.primaryPressed : t.textSecondary;
          const label = typeof options.title === 'string' ? options.title : route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                if (!focused) navigateToTab(route.key);
              }}
              style={styles.tab}
            >
              <View style={[styles.pill, focused && { backgroundColor: t.highlightBg }]}>
                <Icon size={21} color={color} strokeWidth={focused ? 2.1 : 1.6} />
              </View>
              <Text style={[type.caption, { color, fontWeight: focused ? '700' : '500', fontSize: 11 }]} numberOfLines={1}>{label}</Text>
              <View style={[styles.dot, { backgroundColor: focused ? t.accent : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  barWrap: { paddingHorizontal: space.md, paddingTop: space.xs },
  bar: { flexDirection: 'row', borderRadius: 26, borderWidth: 1, paddingTop: space.sm, paddingBottom: 4 },
  pill: { width: 52, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 1 },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 56, justifyContent: 'center' },
});
