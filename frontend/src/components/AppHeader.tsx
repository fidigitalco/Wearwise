import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { CalendarDays, ScanSearch, Sparkles, Sun, UserRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { space, type, useTheme } from '../theme';

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

/** Outline icons, the primary colour when active; sits above the home indicator. Hidden routes (href: null) are skipped. */
export function BottomTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const t = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {state.routes.map((route, i) => {
        if (!TAB_ICONS[route.name]) return null;
        const { options } = descriptors[route.key];
        const focused = state.index === i;
        const Icon = TAB_ICONS[route.name];
        const color = focused ? t.primary : t.textSecondary;
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
            <Icon size={22} color={color} strokeWidth={focused ? 2 : 1.6} />
            <Text style={[type.caption, { color, fontWeight: focused ? '700' : '500' }]} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: space.sm },
  tab: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48, justifyContent: 'center' },
});
