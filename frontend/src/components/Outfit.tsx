import { Bookmark, Check, CloudRain, CloudSun, Heart, MapPin, RefreshCw, Snowflake, Sun, ThumbsDown } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAuth } from '../lib/auth';
import { useI18n, useLabel } from '../lib/i18n';
import { radius, space, type, useTheme } from '../theme';
import type { WeatherInfo } from '../lib/weather';
import type { Garment, Outfit } from '../types';
import { GarmentImage } from './Garment';
import { Button, CompatibilityScore, IconButton } from './ui';

// ── Weather ─────────────────────────────────────────────────────────────────

export function formatTemp(c: number | null | undefined, units?: 'metric' | 'imperial'): string {
  if (c === null || c === undefined) return '–';
  return units === 'imperial' ? `${Math.round((c * 9) / 5 + 32)}°F` : `${Math.round(c)}°C`;
}

export function WeatherIcon({ temp, rain, size = 20, color }: { temp?: number | null; rain?: number | null; size?: number; color: string }) {
  const p = { size, color, strokeWidth: 1.6 };
  if (rain !== null && rain !== undefined && rain >= 0.5) return <CloudRain {...p} />;
  if (temp !== null && temp !== undefined && temp <= 2) return <Snowflake {...p} />;
  if (temp !== null && temp !== undefined && temp >= 22) return <Sun {...p} />;
  return <CloudSun {...p} />;
}

/** "18°C · 0% rain" with a line icon; renders nothing when the temperature is unknown. */
export function WeatherSummary({ temp, rain, compact }: { temp?: number | null; rain?: number | null; compact?: boolean }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const { user } = useAuth();
  if (temp === null || temp === undefined) return null;
  return (
    <View style={styles.weather}>
      <WeatherIcon temp={temp} rain={rain} size={compact ? 15 : 18} color={t.textSecondary} />
      <Text style={[compact ? type.caption : type.label, { color: t.textMuted }]}>
        {formatTemp(temp, user?.units)}
        {rain !== null && rain !== undefined ? ` · ${s.today.rain(Math.round(rain * 100))}` : ''}
      </Text>
    </View>
  );
}

/**
 * Today's weather as a card: icon, temperature, a one-word feel, the day's range
 * and rain, and the city. On the fallback city it offers to turn location on.
 */
/**
 * Today's weather as one quiet line under the greeting: icon, temperature,
 * how it feels, the rain chance and the city. Tapping it, when the forecast is
 * for the fallback city, opens settings to share the location.
 */
export function WeatherLine({ info }: { info: WeatherInfo }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const { user } = useAuth();
  const city = info.city ?? (info.fallback ? s.weather.fallbackCity : null);
  const text = [
    formatTemp(info.temp_c, user?.units),
    s.weather.feel(info.temp_c, info.precip_prob),
    s.today.rain(Math.round(info.precip_prob * 100)),
    city,
  ].filter(Boolean).join('  ·  ');
  return (
    <Pressable onPress={info.fallback ? () => Linking.openSettings() : undefined} disabled={!info.fallback}
      accessibilityRole={info.fallback ? 'button' : 'text'}
      accessibilityHint={info.fallback ? s.weather.useLocation : undefined} style={styles.weatherLine}>
      <WeatherIcon temp={info.temp_c} rain={info.precip_prob} size={18} color={t.textSub} />
      <Text style={[type.label, { color: t.textSub, flexShrink: 1 }]} numberOfLines={1}>{text}</Text>
      {info.fallback ? <MapPin size={14} color={t.primary} /> : null}
    </Pressable>
  );
}

export function WeatherCard({ info, style }: { info: WeatherInfo; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const { user } = useAuth();
  const rain = Math.round(info.precip_prob * 100);
  const city = info.city ?? (info.fallback ? s.weather.fallbackCity : null);
  return (
    <View style={[styles.weatherCard, { backgroundColor: t.cardAlt }, style]}>
      <View style={styles.weatherRow}>
        <WeatherIcon temp={info.temp_c} rain={info.precip_prob} size={28} color={t.text} />
        <Text style={[type.title, { color: t.text }]}>{formatTemp(info.temp_c, user?.units)}</Text>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{s.weather.feel(info.temp_c, info.precip_prob)}</Text>
          <Text style={[type.caption, { color: t.textSub }]} numberOfLines={1}>
            {formatTemp(info.temp_min_c, user?.units)} / {formatTemp(info.temp_max_c, user?.units)} · {s.today.rain(rain)}
          </Text>
        </View>
        {city ? (
          <View style={styles.city}>
            <MapPin size={14} color={t.textSub} />
            <Text style={[type.label, { color: t.textSub }]} numberOfLines={1}>{city}</Text>
          </View>
        ) : null}
      </View>
      {info.fallback ? (
        <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button" hitSlop={6}>
          <Text style={[type.caption, { color: t.text, textDecorationLine: 'underline' }]}>{s.weather.useLocation}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Composition ─────────────────────────────────────────────────────────────

function bySlot(outfit: Outfit): Record<string, Garment> {
  return Object.fromEntries(outfit.items.map((i) => [i.slot, i.garment]));
}

/**
 * An editorial flat-lay of the look on a white frame: the main piece (outer
 * layer, dress or top) large on the left with the shoes beneath; the other
 * pieces stacked on the right.
 */
export function OutfitCollage({ outfit, style, gap = 6 }: { outfit: Outfit; style?: StyleProp<ViewStyle>; gap?: number }) {
  const t = useTheme();
  const g = bySlot(outfit);
  const main = g.outerwear ?? g.dress ?? g.top;
  const right = [g.top, g.dress, g.bottom].filter((x) => x && x !== main) as Garment[];
  const extras = [g.accessory, g.bag].filter(Boolean) as Garment[];
  return (
    <View style={[styles.collage, { gap, padding: gap, backgroundColor: t.card, borderColor: t.border }, style]}>
      <View style={{ flex: 1.15, gap }}>
        {main ? <GarmentImage garment={main} style={{ flex: 3 }} iconSize={40} rounded={radius.sm} /> : null}
        {g.shoes ? <GarmentImage garment={g.shoes} style={{ flex: 1.3 }} iconSize={24} rounded={radius.sm} /> : null}
      </View>
      <View style={{ flex: 1, gap }}>
        {right.map((x) => <GarmentImage key={x.id} garment={x} style={{ flex: 2 }} iconSize={32} rounded={radius.sm} />)}
        {extras.length ? (
          <View style={{ flex: 1, flexDirection: 'row', gap }}>
            {extras.map((x) => <GarmentImage key={x.id} garment={x} style={{ flex: 1 }} iconSize={20} rounded={radius.sm} />)}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** One quiet line of context: "Work · Smart casual · 18°C". */
export function OutfitMeta({ outfit }: { outfit: Outfit }) {
  const t = useTheme();
  const label = useLabel();
  const { user } = useAuth();
  const c = outfit.context;
  const parts = [
    c?.occasion ? label('occasions', c.occasion) : null,
    c?.style ? label('styles', c.style) : null,
    c?.temp_c !== null && c?.temp_c !== undefined ? formatTemp(c.temp_c, user?.units) : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={1}>{parts.join('  ·  ')}</Text>;
}

export function outfitTitle(outfit: Outfit, fallback: string) {
  return outfit.title || fallback;
}

function reasonLine(outfit: Outfit) {
  return outfit.reasons?.[0] || outfit.explanation || '';
}

// ── Cards ───────────────────────────────────────────────────────────────────

/**
 * A recommendation. `featured` is the recommended look (composition, name,
 * match, context, why, actions); `compact` is an alternative preview.
 */
export function OutfitCard({
  outfit, fallbackTitle, liked, onLike, onDislike, onToggleSave, onOpen, variant = 'featured',
}: {
  outfit: Outfit;
  fallbackTitle: string;
  liked?: boolean | null;
  onLike?: () => void;
  onDislike?: () => void;
  onToggleSave?: () => void;
  onOpen: () => void;
  variant?: 'featured' | 'compact';
}) {
  const t = useTheme();
  const { t: s } = useI18n();
  const title = outfitTitle(outfit, fallbackTitle);

  if (variant === 'compact') {
    return (
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [{ gap: space.sm, opacity: pressed ? 0.85 : 1 }]}>
        <OutfitCollage outfit={outfit} style={{ aspectRatio: 0.9 }} gap={4} />
        <View style={{ gap: 2 }}>
          <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{title}</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><OutfitMeta outfit={outfit} /></View>
            <CompatibilityScore value={outfit.total_score} size="sm" />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={title}>
        <OutfitCollage outfit={outfit} style={{ aspectRatio: 1.05 }} />
      </Pressable>
      <View style={{ gap: 4 }}>
        <View style={styles.row}>
          <Text style={[type.title, { color: t.text, flex: 1 }]} numberOfLines={1}>{title}</Text>
          <CompatibilityScore value={outfit.total_score} />
        </View>
        <OutfitMeta outfit={outfit} />
        {reasonLine(outfit) ? <Text style={[type.body, { color: t.textSub }]} numberOfLines={2}>{reasonLine(outfit)}</Text> : null}
      </View>
      <View style={styles.actions}>
        {onLike ? (
          <IconButton label={s.outfit.like} active={liked === true} onPress={onLike}
            icon={<Heart size={20} color={liked === true ? t.text : t.textSecondary} fill={liked === true ? t.text : 'transparent'} strokeWidth={1.6} />} />
        ) : null}
        {onDislike ? (
          <IconButton label={s.outfit.dislike} active={liked === false} onPress={onDislike}
            icon={<ThumbsDown size={20} color={liked === false ? t.text : t.textSecondary} strokeWidth={1.6} />} />
        ) : null}
        {onToggleSave ? (
          <IconButton label={outfit.saved ? s.outfit.saved : s.outfit.save} active={outfit.saved} onPress={onToggleSave}
            icon={<Bookmark size={20} color={outfit.saved ? t.text : t.textSecondary} fill={outfit.saved ? t.text : 'transparent'} strokeWidth={1.6} />} />
        ) : null}
        <View style={{ flex: 1 }} />
        <Button title={s.outfit.details} variant="secondary" size="sm" onPress={onOpen} />
      </View>
    </View>
  );
}

/** Today's Look: the primary recommendation, large, with view / save / wear / regenerate. */
export function OutfitHeroCard({
  outfit, fallbackTitle, onOpen, onAnother, loadingAnother, onToggleSave, onWear, worn,
}: {
  outfit: Outfit;
  fallbackTitle: string;
  onOpen: () => void;
  onAnother?: () => void;
  loadingAnother?: boolean;
  onToggleSave?: () => void;
  onWear?: () => void;
  worn?: boolean;
}) {
  const t = useTheme();
  const { t: s } = useI18n();
  const title = outfitTitle(outfit, fallbackTitle);
  return (
    <View style={{ gap: space.lg }}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={title}>
        <OutfitCollage outfit={outfit} style={{ aspectRatio: 0.95 }} gap={8} />
      </Pressable>
      <View style={{ gap: 6 }}>
        <View style={styles.row}>
          <Text style={[type.display, { color: t.text, flex: 1, fontSize: 26, lineHeight: 32 }]}>{title}</Text>
          <CompatibilityScore value={outfit.total_score} />
        </View>
        <OutfitMeta outfit={outfit} />
        {reasonLine(outfit) ? <Text style={[type.body, { color: t.textSub }]} numberOfLines={2}>{reasonLine(outfit)}</Text> : null}
      </View>
      <View style={styles.heroActions}>
        <Button title={s.home.viewOutfit} style={{ flex: 1 }} onPress={onOpen} />
        {onToggleSave ? (
          <HeroIcon label={outfit.saved ? s.outfit.saved : s.outfit.save} onPress={onToggleSave}
            icon={<Bookmark size={20} color={t.text} fill={outfit.saved ? t.text : 'transparent'} strokeWidth={1.6} />} />
        ) : null}
        {onWear ? (
          <HeroIcon label={worn ? s.home.wornShort : s.home.wearShort} onPress={worn ? undefined : onWear}
            icon={<Check size={20} color={worn ? t.success : t.text} strokeWidth={1.8} />} />
        ) : null}
        {onAnother ? (
          <HeroIcon label={s.home.anotherShort} onPress={loadingAnother ? undefined : onAnother}
            icon={<RefreshCw size={20} color={loadingAnother ? t.textSecondary : t.text} strokeWidth={1.6} />} />
        ) : null}
      </View>
    </View>
  );
}

function HeroIcon({ icon, label, onPress }: { icon: ReactNode; label: string; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.heroIconWrap, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.heroIcon, { borderColor: t.border, backgroundColor: t.card }]}>{icon}</View>
      <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  weatherCard: { borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  weatherLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  city: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 110 },
  weather: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  collage: { flexDirection: 'row', borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginLeft: -10 },
  heroActions: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  heroIconWrap: { alignItems: 'center', gap: 4, minWidth: 56 },
  heroIcon: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
