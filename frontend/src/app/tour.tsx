import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tour } from '../components/Tour';
import { Button, IconButton } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { gutter, space, useTheme } from '../theme';

/** The welcome tour again, from Profile: what WearWise does, page by page. */
export default function TourScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const last = page >= s.tour.slides.length - 1;

  const next = () => {
    if (last) {
      router.back();
      return;
    }
    pager.current?.scrollTo({ x: (page + 1) * width, animated: true });
    setPage(page + 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.top}>
        <IconButton icon={<X size={22} color={t.text} />} label={s.tour.close} onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1, paddingBottom: space.lg }}>
        <Tour pagerRef={pager} onPage={setPage} page={page} />
      </View>
      <View style={styles.actions}>
        <Button title={last ? s.tour.done : s.tour.next} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.sm },
  actions: { paddingHorizontal: gutter, paddingBottom: space.lg },
});
