import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GarmentForm, draftToInput, emptyDraft, type GarmentDraft } from '../../components/GarmentForm';
import { Button } from '../../components/ui';
import { errorMessage, garments as garmentsApi, type LocalImage } from '../../lib/api';
import { radius, space, useTheme } from '../../lib/theme';

export default function NewGarmentScreen() {
  const t = useTheme();
  const [photo, setPhoto] = useState<LocalImage | null>(null);
  const [draft, setDraft] = useState<GarmentDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const pick = async (source: 'camera' | 'library') => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        source === 'camera' ? 'Camera access is off' : 'Photo access is off',
        'You can turn it on for WearWise in Settings.',
      );
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setPhoto({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName });
    }
  };

  const save = async () => {
    if (!draft.subcategory) {
      Alert.alert('What kind of piece is it?', 'Pick a type, e.g. Shirt or Jeans.');
      return;
    }
    if (!photo && draft.colors.length === 0) {
      Alert.alert('Add a photo or a colour', 'Without a photo, pick at least one colour so it can be matched.');
      return;
    }
    setSaving(true);
    try {
      const input = draftToInput(draft);
      // With a photo and no manual picks, the server detects the colours.
      if (photo && draft.colors.length === 0) delete input.colors;
      await garmentsApi.create(input, photo ?? undefined);
      router.back();
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        {photo ? (
          <Pressable onPress={() => pick('library')} accessibilityRole="button" accessibilityLabel="Change photo">
            <Image source={{ uri: photo.uri }} style={[styles.photo, { backgroundColor: t.cardAlt }]} contentFit="contain" />
          </Pressable>
        ) : (
          <View style={[styles.photo, styles.placeholder, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
            <Ionicons name="shirt-outline" size={44} color={t.textMuted} />
            <Text style={{ color: t.textSub, textAlign: 'center' }}>Lay it flat on a plain background, in daylight.</Text>
          </View>
        )}
        <View style={styles.row}>
          <Button
            title="Camera"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => pick('camera')}
            icon={<Ionicons name="camera-outline" size={18} color={t.text} />}
          />
          <Button
            title="Photos"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => pick('library')}
            icon={<Ionicons name="images-outline" size={18} color={t.text} />}
          />
        </View>

        <GarmentForm
          draft={draft}
          onChange={setDraft}
          colorsHint={photo ? 'Leave empty and they are picked from the photo.' : undefined}
        />

        <Button title="Save to closet" onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.lg },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: space.md, borderWidth: 1, borderStyle: 'dashed', padding: space.xl },
  row: { flexDirection: 'row', gap: space.md },
});
