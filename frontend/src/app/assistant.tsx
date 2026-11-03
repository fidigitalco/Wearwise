import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ImagePlus, Mic, Send, Sparkles, Trash2, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GarmentImage } from '../components/Garment';
import { OutfitCollage } from '../components/Outfit';
import { useToast } from '../components/Overlays';
import { ShoppingCard } from '../components/Shopping';
import { Button, Chip, ChipWrap, CompatibilityScore, EmptyState, IconButton } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { assistant, errorMessage, garments as garmentsApi, type LocalImage } from '../services/api';
import { gutter, radius, space, type, useTheme } from '../theme';
import type { Garment, Outfit, ShoppingSuggestion } from '../types';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** A photo the user shared with the question. */
  photo?: LocalImage;
  outfits?: Outfit[];
  garments?: Garment[];
  /** Fields of a recognised photo, offered as "Add to wardrobe" with the photo of the question. */
  piece?: Partial<Garment> | null;
  piecePhoto?: LocalImage;
  added?: boolean;
  shopping?: ShoppingSuggestion[];
  suggestions?: string[];
  error?: boolean;
};

function duration(ms: number) {
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/**
 * Conversational styling over the user's own wardrobe; the answers come from the
 * server's stylist service. Questions can be typed, carry a photo, or be spoken
 * (recorded here, transcribed on the server). A recording can be deleted before
 * it is sent, to start again.
 */
export default function AssistantScreen() {
  const t = useTheme();
  const toast = useToast();
  const { t: s } = useI18n();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [photo, setPhoto] = useState<LocalImage | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const list = useRef<FlatList<Message>>(null);
  const nextId = useRef(0);
  const newId = (prefix: string) => `${prefix}${++nextId.current}`;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const send = async (text: string, attach?: { image?: LocalImage; audio?: LocalImage }) => {
    const q = text.trim();
    if ((!q && !attach?.image && !attach?.audio) || busy) return;
    const userId = newId('u');
    setInput('');
    setPhoto(null);
    setMessages((m) => [
      ...m,
      { id: userId, role: 'user', text: q || (attach?.audio ? s.assistant.voiceMessage : attach?.image ? s.assistant.photoQuestion : ''), photo: attach?.image },
    ]);
    setBusy(true);
    try {
      const r = await assistant.ask(q, attach);
      setMessages((m) => [
        ...m.map((x) => (x.id === userId && r.heard ? { ...x, text: r.heard } : x)),
        {
          id: newId('a'), role: 'assistant', text: r.reply, outfits: r.outfits, garments: r.garments,
          piece: r.piece, piecePhoto: r.piece ? attach?.image : undefined, shopping: r.shopping, suggestions: r.suggestions,
        },
      ]);
    } catch (e: any) {
      const code = e?.response?.data?.code;
      const text = code === 'voice_unavailable' ? s.assistant.voiceUnavailable : code === 'voice_empty' ? s.assistant.voiceEmpty : s.assistant.error;
      setMessages((m) => [...m, { id: newId('e'), role: 'assistant', text, error: true }]);
    } finally {
      setBusy(false);
      setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(source === 'camera' ? s.add.cameraOff : s.add.photosOff, s.add.turnOn);
      return;
    }
    const res = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true });
    const a = !res.canceled ? res.assets[0] : null;
    if (a) setPhoto({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName });
  };

  const choosePhoto = () =>
    Alert.alert(s.assistant.attach, undefined, [
      { text: s.assistant.takePhoto, onPress: () => pickPhoto('camera') },
      { text: s.assistant.choosePhoto, onPress: () => pickPhoto('library') },
      { text: s.common.cancel, style: 'cancel' },
    ]);

  const startRecording = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(s.assistant.micOff, s.add.turnOn);
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  };

  /** Stops the recorder; resolves to the recording, or null when it is being thrown away. */
  const stopRecording = async (keep: boolean): Promise<LocalImage | null> => {
    setRecording(false);
    await recorder.stop();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    return keep && recorder.uri ? { uri: recorder.uri, mimeType: 'audio/m4a', fileName: 'question.m4a' } : null;
  };

  const sendRecording = () =>
    stopRecording(true).then((audio) => audio && send(input, { audio, image: photo ?? undefined }));

  const addToCloset = async (m: Message) => {
    if (!m.piece || !m.piecePhoto) return;
    setAdding(m.id);
    try {
      await garmentsApi.create(m.piece, m.piecePhoto);
      setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, added: true } : x)));
      toast(s.assistant.added);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setAdding(null);
    }
  };

  const last = messages[messages.length - 1];
  const canSend = !!input.trim() || !!photo;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={{ gap: space.lg }}>
            <EmptyState illustration={<Sparkles size={36} color={t.primary} />} title={s.assistant.emptyTitle} body={s.assistant.emptyBody} />
            <ChipWrap>
              {s.assistant.examples.map((e) => <Chip key={e} label={e} onPress={() => send(e)} />)}
            </ChipWrap>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ gap: space.sm, alignItems: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {item.photo ? (
              <Image source={{ uri: item.photo.uri }} style={[styles.sharedPhoto, { backgroundColor: t.sand }]} contentFit="cover" />
            ) : null}
            <View
              style={[
                styles.bubble,
                item.role === 'user'
                  ? { backgroundColor: t.primary, borderBottomRightRadius: 6 }
                  : { backgroundColor: t.card, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 6 },
              ]}
            >
              <Text style={[type.body, { color: item.role === 'user' ? t.onPrimary : item.error ? t.danger : t.text }]}>{item.text}</Text>
            </View>
            {item.garments?.length ? (
              <FlatList
                horizontal
                data={item.garments}
                keyExtractor={(g) => g.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm }}
                style={{ alignSelf: 'stretch' }}
                renderItem={({ item: g }) => (
                  <Pressable onPress={() => router.push({ pathname: '/garment/[id]', params: { id: g.id } })} accessibilityRole="button"
                    accessibilityLabel={g.name} style={[styles.piece, { backgroundColor: t.card, borderColor: t.border }]}>
                    <GarmentImage garment={g} style={{ aspectRatio: 1 }} iconSize={24} rounded={radius.sm} />
                    <Text style={[type.caption, { color: t.text }]} numberOfLines={1}>{g.name}</Text>
                  </Pressable>
                )}
              />
            ) : null}
            {item.piece && item.piecePhoto ? (
              <Button size="sm" variant={item.added ? 'ghost' : 'secondary'} title={item.added ? s.assistant.added : s.assistant.addToCloset}
                disabled={item.added} loading={adding === item.id} onPress={() => addToCloset(item)} />
            ) : null}
            {item.shopping?.length ? (
              <FlatList
                horizontal
                data={item.shopping}
                keyExtractor={(x) => x.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm }}
                style={{ alignSelf: 'stretch' }}
                renderItem={({ item: x }) => <ShoppingCard item={x} width={240} />}
              />
            ) : null}
            {item.outfits?.length ? (
              <FlatList
                horizontal
                data={item.outfits}
                keyExtractor={(o) => o.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm }}
                style={{ alignSelf: 'stretch' }}
                renderItem={({ item: o }) => (
                  <Pressable onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: o.id } })} accessibilityRole="button"
                    accessibilityLabel={o.title || s.looks.fallbackTitle}
                    style={[styles.outfit, { backgroundColor: t.card, borderColor: t.border }]}>
                    <OutfitCollage outfit={o} style={{ aspectRatio: 1 }} gap={4} />
                    <View style={styles.outfitMeta}>
                      <Text style={[type.label, { color: t.text, flex: 1, fontWeight: '600' }]} numberOfLines={1}>{o.title || s.looks.fallbackTitle}</Text>
                      <CompatibilityScore value={o.total_score} size="sm" />
                    </View>
                  </Pressable>
                )}
              />
            ) : null}
            {item === last && item.suggestions?.length && !busy ? (
              <ChipWrap>
                {item.suggestions.map((q) => <Chip key={q} label={q} onPress={() => send(q)} />)}
              </ChipWrap>
            ) : null}
          </View>
        )}
        ListFooterComponent={
          busy ? (
            <View style={[styles.bubble, styles.thinking, { backgroundColor: t.card, borderColor: t.border }]}>
              <ActivityIndicator size="small" color={t.primary} />
              <Text style={[type.label, { color: t.textMuted }]}>{s.assistant.thinking}</Text>
            </View>
          ) : undefined
        }
      />
      <View style={[styles.composerWrap, { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: insets.bottom + space.sm }]}>
        {photo ? (
          <View style={styles.attachment}>
            <Image source={{ uri: photo.uri }} style={[styles.attachmentImage, { backgroundColor: t.sand }]} contentFit="cover" />
            <Pressable onPress={() => setPhoto(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={s.assistant.removePhoto}
              style={[styles.attachmentRemove, { backgroundColor: t.text }]}>
              <X size={12} color={t.card} />
            </Pressable>
          </View>
        ) : null}
        {recording ? (
          <View style={styles.composer}>
            <IconButton icon={<Trash2 size={20} color={t.danger} />} label={s.assistant.cancelRecording} onPress={() => stopRecording(false)} />
            <View style={[styles.recordingBar, { backgroundColor: t.bg, borderColor: t.border }]} accessibilityLiveRegion="polite">
              <View style={[styles.recDot, { backgroundColor: t.danger }]} />
              <Text style={[type.body, { color: t.text, flex: 1 }]}>{s.assistant.recording}</Text>
              <Text style={[type.label, { color: t.textMuted, fontVariant: ['tabular-nums'] }]}>{duration(recorderState.durationMillis)}</Text>
            </View>
            <IconButton icon={<Send size={20} color={t.onPrimary} />} label={s.assistant.sendRecording} onPress={sendRecording}
              style={{ backgroundColor: t.primary }} />
          </View>
        ) : (
          <View style={styles.composer}>
            <IconButton icon={<ImagePlus size={22} color={busy ? t.textSecondary : t.text} />} label={s.assistant.attach}
              onPress={busy ? undefined : choosePhoto} />
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={s.assistant.placeholder}
              placeholderTextColor={t.textMuted}
              onSubmitEditing={() => send(input, photo ? { image: photo } : undefined)}
              returnKeyType="send"
              multiline
              maxLength={1000}
              accessibilityLabel={s.assistant.placeholder}
              style={[type.body, styles.input, { color: t.text, backgroundColor: t.bg, borderColor: t.border }]}
            />
            {canSend ? (
              <IconButton icon={<Send size={20} color={t.onPrimary} />} label={s.assistant.send}
                onPress={() => send(input, photo ? { image: photo } : undefined)} style={{ backgroundColor: t.primary }} />
            ) : (
              <IconButton icon={<Mic size={20} color={busy ? t.textSecondary : t.text} />} label={s.assistant.voice}
                onPress={busy ? undefined : startRecording} style={{ backgroundColor: t.cardAlt }} />
            )}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.lg, flexGrow: 1 },
  bubble: { maxWidth: '86%', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: StyleSheet.hairlineWidth, marginTop: space.lg },
  sharedPhoto: { width: 180, height: 180, borderRadius: radius.lg },
  piece: { width: 104, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 5, gap: 5 },
  outfit: { width: 168, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 6, gap: 6 },
  outfitMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 2, paddingBottom: 2 },
  composerWrap: { gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, paddingHorizontal: space.lg, paddingTop: 11, paddingBottom: 11 },
  attachment: { width: 64, height: 64, marginLeft: space.xs, marginTop: space.xs },
  attachmentImage: { width: 64, height: 64, borderRadius: radius.md },
  attachmentRemove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  recordingBar: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: 22, borderWidth: 1, paddingHorizontal: space.lg },
  recDot: { width: 10, height: 10, borderRadius: 5 },
});
