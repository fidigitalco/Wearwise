import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToast } from '../components/Overlays';
import { ColorPicker } from '../components/ColorPicker';
import { GarmentSketch } from '../components/GarmentSketch';
import { AffiliateSheet, ShoppingCard, type ShopTarget } from '../components/Shopping';
import { Button, Card, Chip, ChipRow, LoadingSkeleton, SectionHeader } from '../components/ui';
import { useI18n, useLabel } from '../lib/i18n';
import { useMeta } from '../lib/meta';
import { errorMessage, getShopping, shopping } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';
import type { Category, FitCheck, ShoppingSuggestion } from '../types';

// Pieces worth checking before buying: the body of an outfit, not accessories.
const CHECK_CATEGORIES: Category[] = ['top', 'bottom', 'dress', 'outerwear', 'shoes'];

/**
 * Shop (prototype spec §2.4): what the closet is missing, each with how many
 * outfits it unlocks, and "Will this fit my wardrobe?" for a piece the user is
 * eyeing. Stores open through the affiliate sheet.
 */
export default function ShopScreen() {
  const t = useTheme();
  const { t: s } = useI18n();
  const label = useLabel();
  const meta = useMeta();
  const toast = useToast();
  const [items, setItems] = useState<ShoppingSuggestion[] | null>(null);
  const [category, setCategory] = useState<Category>('bottom');
  const [sub, setSub] = useState<string>('trousers');
  const [color, setColor] = useState('beige');
  const [result, setResult] = useState<FitCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [target, setTarget] = useState<ShopTarget | null>(null);

  useEffect(() => {
    getShopping().then(setItems).catch(() => setItems([]));
  }, []);

  const pickCategory = (c: Category) => {
    setCategory(c);
    setSub(meta.categories[c]?.[0] ?? '');
    setResult(null);
  };

  const check = () => {
    setChecking(true);
    shopping.check(sub, color)
      .then(setResult)
      .catch((e) => toast(errorMessage(e), 'error'))
      .finally(() => setChecking(false));
  };

  const tone = result ? { great: t.success, works: t.primary, skip: t.danger }[result.verdict] : t.text;

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      <View style={{ gap: space.md }}>
        <SectionHeader title={s.shop.missing} />
        {items === null ? (
          <LoadingSkeleton height={150} radius={radius.lg} />
        ) : items.length ? (
          items.map((i) => <ShoppingCard key={i.id} item={i} onFind={(x) => setTarget({ ...x, source: 'gap' })} />)
        ) : (
          <Text style={[type.body, { color: t.textSub }]}>{s.shop.nothingMissing}</Text>
        )}
      </View>

      <View style={{ gap: space.md }}>
        <View style={{ gap: 2 }}>
          <SectionHeader title={s.shop.checkTitle} />
          <Text style={[type.caption, { color: t.textMuted }]}>{s.shop.checkHint}</Text>
        </View>
        <Text style={[type.overline, { color: t.textMuted }]}>{s.shop.pickType}</Text>
        <ChipRow inset={gutter}>
          {CHECK_CATEGORIES.map((c) => <Chip key={c} label={label('categories', c)} selected={category === c} onPress={() => pickCategory(c)} />)}
        </ChipRow>
        <ChipRow inset={gutter}>
          {(meta.categories[category] ?? []).map((x) => (
            <Chip key={x} label={label('subcategories', x)} selected={sub === x} onPress={() => { setSub(x); setResult(null); }} />
          ))}
        </ChipRow>
        <Text style={[type.overline, { color: t.textMuted }]}>{s.shop.pickColor}</Text>
        <ColorPicker single value={[{ name: color }]} onToggle={(c) => { setColor(c); setResult(null); }} />
        <Button title={s.shop.check} onPress={check} loading={checking} disabled={!sub} />

        {result ? (
          <Card style={{ gap: space.sm }}>
            <View style={styles.verdictHead}>
              <View style={[styles.sketch, { backgroundColor: t.sand }]}>
                <GarmentSketch subcategory={sub} category={category} rgb={meta.colors[color]} size={48} />
              </View>
              <Text style={[type.caption, { color: t.textMuted, flex: 1 }]}>{result.title}</Text>
            </View>
            <Text style={[type.title, { color: tone }]}>{s.shop.verdicts[result.verdict]}</Text>
            <Text style={[type.body, { color: t.textSub }]}>{s.shop.verdictBody(result.matches, result.unlocks)}</Text>
            {result.better ? <Text style={[type.caption, { color: t.textMuted }]}>{s.shop.better(result.better.title, result.better.unlocks)}</Text> : null}
            {result.verdict !== 'skip' ? (
              <Button title={s.shop.find} variant="secondary" size="sm"
                onPress={() => setTarget({ title: result.title, subcategory: sub, color, links: result.links, source: 'check' })} />
            ) : null}
          </Card>
        ) : null}
      </View>

      <AffiliateSheet target={target} onClose={() => setTarget(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, gap: space.xxl, paddingBottom: space.xxl * 2 },
  verdictHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sketch: { width: 60, height: 60, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
