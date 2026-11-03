import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Layers, Plus, Shirt, Sun, UserRound } from 'lucide-react-native';
import { Fragment, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { space, type, useTheme } from '../theme';
import { AddSheet } from './AddSheet';

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
  closet: Shirt,
  outfits: Layers,
  profile: UserRound,
};

/**
 * Outline icons, indigo when active; sits above the home indicator. A raised +
 * in the middle adds a piece from any tab.
 */
export function BottomTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const t = useTheme();
  const { t: s } = useI18n();
  const [adding, setAdding] = useState(false);
  const middle = Math.ceil(state.routes.length / 2);
  return (
    <>
    <View style={[styles.bar, { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key];
        const focused = state.index === i;
        const Icon = TAB_ICONS[route.name] ?? Sun;
        const color = focused ? t.primary : t.textSecondary;
        const label = typeof options.title === 'string' ? options.title : route.name;
        return (
          <Fragment key={route.key}>
          {i === middle ? (
            <View style={styles.tab}>
              <Pressable
                onPress={() => setAdding(true)}
                accessibilityRole="button"
                accessibilityLabel={s.wardrobe.addTitle}
                hitSlop={6}
                style={({ pressed }) => [styles.add, { backgroundColor: pressed ? t.primaryPressed : t.primary, borderColor: t.card }]}
              >
                <Plus size={26} color={t.onPrimary} strokeWidth={2} />
              </Pressable>
            </View>
          ) : null}
          <Pressable
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
          </Fragment>
        );
      })}
    </View>
    <AddSheet visible={adding} onClose={() => setAdding(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: space.sm },
  tab: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48, justifyContent: 'center' },
  // Raised above the bar's top edge; the ring in the bar colour separates it from the screen.
  add: { width: 56, height: 56, borderRadius: 28, borderWidth: 4, alignItems: 'center', justifyContent: 'center', marginTop: -26 },
});
