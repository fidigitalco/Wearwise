import { Tabs } from 'expo-router';
import { BottomTabBar } from '../../components/AppHeader';
import { useI18n } from '../../lib/i18n';
import { useTheme } from '../../theme';

export default function TabsLayout() {
  const t = useTheme();
  const { t: s } = useI18n();
  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: s.tabs.today }} />
      <Tabs.Screen name="closet" options={{ title: s.tabs.closet }} />
      <Tabs.Screen name="outfits" options={{ title: s.tabs.outfits }} />
      <Tabs.Screen name="profile" options={{ title: s.tabs.settings }} />
    </Tabs>
  );
}
