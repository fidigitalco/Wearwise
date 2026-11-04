import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setApiLanguage } from '../services/api';
import { az } from './strings/az';
import { en, type Strings } from './strings/en';
import { es } from './strings/es';
import { ru } from './strings/ru';
import { tr } from './strings/tr';

export type { Strings };

export type Lang = 'az' | 'en' | 'ru' | 'tr' | 'es';

const STRINGS: Record<Lang, Strings> = { az, en, ru, tr, es };

/** Each language in its own name, in the order the picker shows them. */
export const LANGUAGES: { code: Lang; name: string }[] = [
  { code: 'az', name: 'Azərbaycanca' },
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'es', name: 'Español' },
];

/** BCP 47 tag for dates and numbers. */
export const LOCALES: Record<Lang, string> = {
  az: 'az-AZ', en: 'en-GB', ru: 'ru-RU', tr: 'tr-TR', es: 'es-ES',
};

const isLang = (v: unknown): v is Lang => typeof v === 'string' && v in STRINGS;
const STORAGE_KEY = 'WEARWISE_LANG';

/** The phone's language when it is one we speak; Azerbaijani otherwise (the home market). */
function deviceLang(): Lang {
  try {
    const code = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().split('-')[0];
    return isLang(code) ? code : 'az';
  } catch {
    return 'az';
  }
}

type I18n = { lang: Lang; t: Strings; setLang: (l: Lang) => void };

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(deviceLang);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (isLang(saved)) setLangState(saved);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setApiLanguage(lang);
  }, [lang]);

  const value = useMemo<I18n>(
    () => ({
      lang,
      t: STRINGS[lang],
      setLang: (l) => {
        setLangState(l);
        AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
      },
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

type TxKind = Exclude<keyof Strings['tx'], 'styleExamples'>;

/** Display name for a taxonomy value ("rain_jacket" → "Yağış gödəkçəsi"), falling back to "Rain jacket". */
export function useLabel() {
  const { t } = useI18n();
  return (kind: TxKind, value: string | null | undefined): string => {
    if (!value) return '';
    const hit = t.tx[kind][value];
    if (hit) return hit;
    const s = value.replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
}
