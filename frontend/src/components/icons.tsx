import { Footprints, Gem, Layers, ShoppingBag, Shirt } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import type { Category } from '../types';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

// Drawn in Lucide's style (24-unit grid, round caps and joins) for the shapes
// the set does not have.

/** The WearWise mark: a minimal coat hanger. */
export function Hanger({ size = 24, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9.5 6.5a2.5 2.5 0 1 1 3.4 2.33c-.55.21-.9.73-.9 1.32V11" />
      <Path d="M12 11 3.2 17.2A1 1 0 0 0 3.8 19h16.4a1 1 0 0 0 .6-1.8L12 11Z" />
    </Svg>
  );
}

export function Trousers({ size = 24, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 3h12l1 18h-5l-2-11-2 11H5L6 3Z" />
      <Path d="M6 7h12" />
    </Svg>
  );
}

export function Dress({ size = 24, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 2v3l-1.5 4h9L15 5V2" />
      <Path d="M7.5 9 4 21h16L16.5 9" />
    </Svg>
  );
}

const BY_CATEGORY: Record<Category, (p: IconProps) => React.ReactElement> = {
  top: (p) => <Shirt {...p} />,
  bottom: (p) => <Trousers {...p} />,
  dress: (p) => <Dress {...p} />,
  outerwear: (p) => <Layers {...p} />,
  shoes: (p) => <Footprints {...p} />,
  accessory: (p) => <Gem {...p} />,
  bag: (p) => <ShoppingBag {...p} />,
};

export function CategoryIcon({ category, ...p }: IconProps & { category: Category | string }) {
  const render = BY_CATEGORY[category as Category] ?? BY_CATEGORY.top;
  return render(p);
}
