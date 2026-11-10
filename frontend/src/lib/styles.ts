/** A colour that stands for each style on its card, where there is no photo. */
export const STYLE_COLOR: Record<string, string> = {
  minimal: '#D8D2C8', old_money: '#2F3B52', quiet_luxury: '#B9A58C', classic: '#3A3A48', casual: '#6E86A8', smart_casual: '#5A5F6E',
  business: '#2B2D3A', formal: '#1F1F2A', streetwear: '#4B4B4B', sporty: '#9AA6B2', athleisure: '#7C8AA0', scandi: '#E6E2DA',
  parisian_chic: '#1F1F2A', bohemian: '#B5764A', romantic: '#E8C3CC', vintage: '#8C6A4F', y2k: '#D58BD0', preppy: '#2F5A3A',
  grunge: '#3F3A33', edgy: '#1A1A1A', coastal: '#CFE0E8', cottagecore: '#C9D3A8', korean: '#EAD9E3', gorpcore: '#5C6B3C',
  glam: '#6B2E3E', modest: '#9B8BA8', techwear: '#2C3036', western: '#9C6B3F',
};

/** Example photos for the style cards (Unsplash, see assets/images/CREDITS.md); styles without one show their colour. */
export const STYLE_PHOTOS: Record<string, number> = {
  casual: require('../../assets/images/style-casual.jpg'),
  smart_casual: require('../../assets/images/style-smart_casual.jpg'),
  business: require('../../assets/images/style-business.jpg'),
  minimal: require('../../assets/images/style-minimal.jpg'),
  streetwear: require('../../assets/images/style-streetwear.jpg'),
  classic: require('../../assets/images/style-classic.jpg'),
  sporty: require('../../assets/images/style-sporty.jpg'),
  bohemian: require('../../assets/images/style-bohemian.jpg'),
  formal: require('../../assets/images/style-formal.jpg'),
};
