import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setApiLanguage } from '../services/api';
import { az } from './strings/az';
import { en, type Strings } from './strings/en';

export type { Strings };

export type Lang = 'az' | 'en';

const STRINGS: Record<Lang, Strings> = { en, az };
const STORAGE_KEY = 'WEARWISE_LANG';

/** The phone's language when it is one we speak; Azerbaijani otherwise (the home market). */
function deviceLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    return locale.startsWith('en') ? 'en' : 'az';
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
        if (saved === 'az' || saved === 'en') setLangState(saved);
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
