import { router } from 'expo-router';
import { Camera, Image as ImageIcon, PenLine, Video } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../theme';
import { BottomSheet, SheetAction } from './Overlays';

/** The ways to add a piece: photo, gallery, closet video or by hand. Opened from the tab bar's + and the closet. */
export function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { t: s } = useI18n();
  const start = (mode: 'camera' | 'library' | 'video' | 'manual') => {
    onClose();
    router.push({ pathname: '/garment/new', params: { mode } });
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={s.wardrobe.addTitle} closeLabel={s.common.close}>
      <SheetAction icon={<Camera size={20} color={t.primary} />} label={s.wardrobe.takePhoto} hint={s.wardrobe.takePhotoHint} onPress={() => start('camera')} />
      <SheetAction icon={<ImageIcon size={20} color={t.primary} />} label={s.wardrobe.gallery} hint={s.wardrobe.galleryHint} onPress={() => start('library')} />
      <SheetAction icon={<Video size={20} color={t.primary} />} label={s.wardrobe.video} hint={s.wardrobe.videoHint} onPress={() => start('video')} />
      <SheetAction icon={<PenLine size={20} color={t.primary} />} label={s.wardrobe.manual} hint={s.wardrobe.manualHint} onPress={() => start('manual')} />
    </BottomSheet>
  );
}
