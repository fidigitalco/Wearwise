import { CircleCheck, CircleAlert } from 'lucide-react-native';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { elevation, radius, space, type, useTheme } from '../theme';
import { Button } from './ui';

// ── Toast ───────────────────────────────────────────────────────────────────

type Toast = { message: string; tone: 'success' | 'error' };
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {});

/** Short confirmation after an action ("Saved", "Planned for Friday"), shown above the tab bar. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, tone: Toast['tone'] = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
      }, 2200);
    },
    [opacity],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[styles.toast, elevation(t, 2), { bottom: insets.bottom + 84, backgroundColor: t.text, opacity }]}
        >
          {toast.tone === 'success' ? <CircleCheck size={18} color={t.bg} /> : <CircleAlert size={18} color={t.bg} />}
          <Text style={[type.label, { color: t.bg, flex: 1 }]}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ── Bottom sheet ────────────────────────────────────────────────────────────

export function BottomSheet({
  visible, onClose, title, children, closeLabel,
}: { visible: boolean; onClose: () => void; title?: string; children: ReactNode; closeLabel: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: t.overlay }]} onPress={onClose} accessibilityLabel={closeLabel} />
      <View style={[styles.sheet, { backgroundColor: t.card, paddingBottom: insets.bottom + space.lg }]}>
        <View style={[styles.handle, { backgroundColor: t.border }]} />
        {title ? <Text style={[type.title, { color: t.text }]}>{title}</Text> : null}
        <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: space.md }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** A row in a bottom sheet menu: icon, label, optional hint. */
export function SheetAction({
  icon, label, hint, onPress, danger,
}: { icon: ReactNode; label: string; hint?: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, { backgroundColor: pressed ? t.cardAlt : t.bg }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: danger ? 'transparent' : t.highlightBg }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: danger ? t.danger : t.text }]}>{label}</Text>
        {hint ? <Text style={[type.caption, { color: t.textMuted }]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

// ── Confirmation dialog ─────────────────────────────────────────────────────

export function ConfirmationDialog({
  visible, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, destructive,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.center, { backgroundColor: t.overlay }]}>
        <View style={[styles.dialog, { backgroundColor: t.card }]} accessibilityViewIsModal>
          <Text style={[type.title, { color: t.text }]}>{title}</Text>
          {message ? <Text style={[type.body, { color: t.textSub }]}>{message}</Text> : null}
          <View style={styles.dialogActions}>
            <Button title={cancelLabel} variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
            <Button
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              style={[{ flex: 1 }, destructive && { backgroundColor: t.danger, borderColor: t.danger }]}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md,
  },
  backdrop: { flex: 1 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, gap: space.md,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, minHeight: 60 },
  actionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  dialog: { width: '100%', maxWidth: 400, borderRadius: radius.lg, padding: space.xl, gap: space.md },
  dialogActions: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
});
