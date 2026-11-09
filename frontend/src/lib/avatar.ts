import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { User } from '../types';
import { useAuth } from './auth';

/**
 * The avatar's body (prototype spec §2.3): skin tone, height, weight and an
 * optional face photo. Height and weight are the profile's (About you), so
 * there is one place to change them; skin tone and the face stay on this
 * phone and are never sent to the server.
 */
export type AvatarProfile = {
  skin: string;
  heightCm: number;
  weightKg: number;
  /** A small square JPEG as a data URI, or null for the drawn head. */
  face: string | null;
};

export const SKIN_TONES = ['#F3D9C6', '#E8BFA0', '#D9A88A', '#BF8A68', '#9C6B4E', '#6E4A36'];

export const DEFAULT_AVATAR: AvatarProfile = { skin: '#D9A88A', heightCm: 172, weightKg: 68, face: null };

const KEY = 'WEARWISE_AVATAR';

/** The phone-only part merged with the height and weight saved on the profile. */
export function withProfile(p: AvatarProfile, user: User | null): AvatarProfile {
  return { ...p, heightCm: user?.height_cm || p.heightCm, weightKg: user?.weight_kg || p.weightKg };
}

export async function loadAvatar(): Promise<AvatarProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_AVATAR, ...JSON.parse(raw) } : DEFAULT_AVATAR;
  } catch {
    return DEFAULT_AVATAR;
  }
}

export function saveAvatar(p: AvatarProfile): Promise<void> {
  return AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
}

/** The saved avatar, re-read whenever the screen comes back into focus. */
export function useAvatar(): AvatarProfile {
  const { user } = useAuth();
  const [p, setP] = useState(DEFAULT_AVATAR);
  useFocusEffect(
    useCallback(() => {
      loadAvatar().then(setP);
    }, []),
  );
  return withProfile(p, user);
}

/**
 * How wide and how tall the figure is drawn (spec §2.3): BMI widens it
 * 0.84–1.28×, height stretches it 0.9–1.1×.
 */
export function bodyScale(p: AvatarProfile): { wide: number; tall: number } {
  const bmi = p.weightKg / (p.heightCm / 100) ** 2;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    wide: clamp(0.84 + ((bmi - 18) / 14) * 0.44, 0.84, 1.28),
    tall: clamp(0.9 + ((p.heightCm - 150) / 50) * 0.2, 0.9, 1.1),
  };
}
