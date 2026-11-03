import { Image } from 'expo-image';
import { useRef, useState, type RefObject } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { useI18n } from '../lib/i18n';
import { gutter, radius, space, type, useTheme } from '../theme';

const IMAGES = [
  require('../../assets/images/welcome.jpg'),
  require('../../assets/images/style-smart_casual.jpg'),
  require('../../assets/images/style-minimal.jpg'),
  require('../../assets/images/style-classic.jpg'),
];

/**
 * What WearWise does, as swipeable pages with dots. A parent with its own
 * "Next" button passes `pagerRef` to scroll it and `page` to keep the dots in
 * step; `onPage` reports swipes.
 */
export function Tour({
  onPage, pagerRef, page: controlled,
}: { onPage?: (i: number) => void; pagerRef?: RefObject<ScrollViewInstance | null>; page?: number }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const { width } = useWindowDimensions();
  const own = useRef<ScrollViewInstance>(null);
  const ref = pagerRef ?? own;
  const [swiped, setSwiped] = useState(0);
  const page = controlled ?? swiped;
  const slides = s.tour.slides;

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setSwiped(i);
    onPage?.(i);
  };

  return (
    <View style={{ flex: 1, gap: space.lg }}>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd} style={{ flex: 1 }}>
        {slides.map((slide, i) => (
          <View key={slide.title} style={[styles.page, { width }]} accessibilityLabel={`${s.tour.page(i + 1, slides.length)}. ${slide.title}. ${slide.body}`}>
            <Image source={IMAGES[i % IMAGES.length]} style={styles.image} contentFit="cover" accessible={false} />
            <View style={{ gap: space.sm }}>
              <Text style={[type.display, { color: t.text, fontSize: 30, lineHeight: 36 }]}>{slide.title}</Text>
              <Text style={[type.body, { color: t.textSub, fontSize: 16, lineHeight: 23 }]}>{slide.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {slides.map((slide, i) => (
          <View key={slide.title} style={[styles.dot, { width: i === page ? 22 : 7, backgroundColor: i === page ? t.text : t.border }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: gutter, gap: space.xl },
  image: { flex: 1, minHeight: 200, borderRadius: radius.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 7, borderRadius: 4 },
});
