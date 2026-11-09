import { Tabs } from 'expo-router';
import { BottomTabBar } from '../../components/AppHeader';
import { useI18n } from '../../lib/i18n';
import { useTheme } from '../../theme';

/**
 * MVP v2 tabs: Home, Discover, Stylist, Dates, Profile. The closet and its
 * outfits are out of the MVP; their screens stay, reachable from Profile.
 */
export default function TabsLayout() {
  const t = useTheme();
  const { t: s } = useI18n();
  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: s.tabs.today }} />
      <Tabs.Screen name="discover" options={{ title: s.tabs.discover }} />
      <Tabs.Screen name="stylist" options={{ title: s.tabs.stylist }} />
      <Tabs.Screen name="dates" options={{ title: s.tabs.dates }} />
      <Tabs.Screen name="profile" options={{ title: s.tabs.settings }} />
      <Tabs.Screen name="closet" options={{ title: s.tabs.closet, href: null }} />
      <Tabs.Screen name="outfits" options={{ title: s.tabs.outfits, href: null }} />
    </Tabs>
  );
}
