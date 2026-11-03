'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type Lang = 'az' | 'en'

const STORE_KEY = 'admin_lang'

/**
 * Every string an admin reads, in both languages. Azerbaijani is the source
 * and the default. Keys say what a string means, not where it appears.
 */
const AZ = {
  // ── shared ──
  loading: 'Yüklənir…',
  noData: 'Məlumat yoxdur',
  loadFailed: 'Məlumatlar yüklənmədi',
  retry: 'Yenidən cəhd et',
  checkConnection: 'Serverə qoşulmanı yoxlayın.',
  cancel: 'Ləğv et',
  delete: 'Sil',
  close: 'Bağla',
  search: 'Ad və ya e-poçt ilə axtar…',
  all: 'Hamısı',
  never: 'Heç vaxt',
  yes: 'Bəli',
  no: 'Xeyr',
  adminPanel: 'Admin panel',
  appearance: 'Görünüş',
  themeLight: 'İşıqlı',
  themeDark: 'Qaranlıq',
  language: 'Dil',
  logout: 'Çıxış',
  openMenu: 'Menyunu aç',
  closeMenu: 'Menyunu bağla',
  pageOf: '{{from}}–{{to}} / {{total}}',
  pagePrev: 'Əvvəlki',
  pageNext: 'Növbəti',
  pageGoTo: '{{page}}-ci səhifə',
  chartCount: 'Say',

  // ── navigation ──
  navDashboard: 'İdarə paneli',
  navAnalytics: 'Analitika',
  navUsers: 'İstifadəçilər',
  navPremium: 'Premium',

  // ── login ──
  loginSubtitle: 'Davam etmək üçün admin hesabınla daxil ol',
  loginEmail: 'E-poçt',
  loginPassword: 'Şifrə',
  loginSubmit: 'Daxil ol',
  loginBusy: 'Daxil olunur…',
  loginFailed: 'Daxil olmaq alınmadı',
  loginInvalid: 'E-poçt və ya şifrə yanlışdır.',
  loginNotStaff: 'Bu hesabın admin icazəsi yoxdur.',
  loginDisabled: 'Hesab bloklanıb.',
  loginHint: 'Yalnız admin hesabları daxil ola bilər.',
  loginTagline: 'Qarderobun, kombinlərin və istifadəçilərin bir yerdə.',

  // ── dashboard ──
  dashSubtitle: 'WearWise-da nə baş verir, bir baxışda',
  totalUsers: 'İstifadəçilər',
  newToday: 'bu gün',
  newThisWeek: 'Bu həftə yeni',
  activeUsers: 'Aktiv istifadəçilər',
  last30Days: 'son 30 gün',
  premiumUsers: 'Premium',
  guests: 'Qonaqlar',
  guestsSub: 'qeydiyyatsız baxır',
  blockedUsers: 'Bloklanmış',
  totalGarments: 'Yüklənən paltarlar',
  samplesSub: '{{n}} nümunə paltar ayrıca',
  totalOutfits: 'Kombinlər',
  savedSub: '{{n}} saxlanılıb',
  totalWears: 'Geyinilib',
  plansSub: '{{n}} gələcək plan',
  signupTrend: 'Qeydiyyat (30 gün)',
  garmentCategories: 'Paltar növləri',
  activity: 'Fəaliyyət (30 gün)',

  // ── analytics ──
  analyticsSubtitle: 'İstifadəçilər, qarderob və kombinlər üzrə göstəricilər',
  days: '{{n}} gün',
  signups: 'Qeydiyyat',
  guestVisits: 'Qonaq girişləri',
  looksAsked: 'Kombin istəkləri',
  assistantAsks: 'AI stilist',
  wears: 'Geyinmə qeydi',
  uploads: 'Paltar yükləmə',
  activeInactive: 'Aktiv / passiv',
  inactive: 'Passiv',
  active: 'Aktiv',
  signInMethods: 'Giriş üsulu',
  plans: 'Abunəlik',
  styles: 'Seçilən üslub',
  occasions: 'Əsas məqsəd',
  colors: 'Ən çox rəng',
  feedback: 'Kombinlərə reaksiya',
  liked: 'Bəyənib',
  disliked: 'Bəyənməyib',
  avgGarments: 'İstifadəçi başına paltar',
  onboarded: 'Anketi bitirib',

  // ── users ──
  usersSubtitle: '{{n}} hesab',
  colUser: 'İstifadəçi',
  colMethod: 'Giriş',
  colPlan: 'Plan',
  colCloset: 'Qarderob',
  colOutfits: 'Kombin',
  colWears: 'Geyinib',
  colJoined: 'Qoşulub',
  colStatus: 'Status',
  kindMember: 'Üzvlər',
  kindGuest: 'Qonaqlar',
  kindBlocked: 'Bloklanmış',
  sortNewest: 'Ən yeni',
  sortOldest: 'Ən köhnə',
  sortCloset: 'Ən çox paltar',
  sortWears: 'Ən çox geyinən',
  sortEmail: 'E-poçt (A–Z)',
  guest: 'Qonaq',
  blocked: 'Bloklanıb',
  free: 'Pulsuz',
  premium: 'Premium',
  noUsers: 'Heç kim tapılmadı',
  noName: 'Adsız',
  makePremium: 'Premium et',
  makeFree: 'Pulsuz et',
  block: 'Blokla',
  unblock: 'Blokdan çıxar',
  deleteUser: 'Hesabı sil',
  deleteConfirm: '{{who}} hesabı, qarderobu və şəkilləri birdəfəlik silinsin?',
  joined: 'Qoşulub',
  lastActive: 'Son fəaliyyət',
  style: 'Üslub',
  occasion: 'Məqsəd',
  location: 'Məkan',
  notOnboarded: 'Anketi bitirməyib',
  countGarments: 'Paltar',
  countOutfits: 'Kombin',
  countSaved: 'Saxlanıb',
  countWears: 'Geyinib',
  countPlans: 'Plan',
  countLooks: 'Kombin istəyi',
  countAssistant: 'AI sual',
  countScans: 'Video skan',
  privacyNote: 'Məxfilik: istifadəçinin qarderobu, şəkilləri, kombinləri və nə geyindiyi admin paneldə göstərilmir.',

  // ── premium ──
  premiumSubtitle: 'Abunəliklər. Ödəniş hələ qoşulmayıb, planı burdan dəyişmək olur.',
  freeUsers: 'Pulsuz',
  conversion: 'Premium payı',
  premiumList: 'Premium istifadəçilər',
  noPremium: 'Hələ premium istifadəçi yoxdur',
  priceNote: 'Qiymət: $4.99 / ay · $29.99 / il',

  // ── taxonomy ──
  cat_top: 'Üst',
  cat_bottom: 'Alt',
  cat_dress: 'Don',
  cat_outerwear: 'Üst geyim',
  cat_shoes: 'Ayaqqabı',
  cat_accessory: 'Aksesuar',
  cat_bag: 'Çanta',
  method_email: 'E-poçt',
  method_apple: 'Apple',
  method_google: 'Google',
  method_guest: 'Qonaq',
}

export type Key = keyof typeof AZ

const EN: Record<Key, string> = {
  loading: 'Loading…',
  noData: 'No data',
  loadFailed: 'Could not load the data',
  retry: 'Try again',
  checkConnection: 'Check the connection to the server.',
  cancel: 'Cancel',
  delete: 'Delete',
  close: 'Close',
  search: 'Search by name or email…',
  all: 'All',
  never: 'Never',
  yes: 'Yes',
  no: 'No',
  adminPanel: 'Admin panel',
  appearance: 'Appearance',
  themeLight: 'Light',
  themeDark: 'Dark',
  language: 'Language',
  logout: 'Log out',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  pageOf: '{{from}}–{{to}} of {{total}}',
  pagePrev: 'Previous',
  pageNext: 'Next',
  pageGoTo: 'Page {{page}}',
  chartCount: 'Count',

  navDashboard: 'Dashboard',
  navAnalytics: 'Analytics',
  navUsers: 'Users',
  navPremium: 'Premium',

  loginSubtitle: 'Sign in with your admin account to continue',
  loginEmail: 'Email',
  loginPassword: 'Password',
  loginSubmit: 'Sign in',
  loginBusy: 'Signing in…',
  loginFailed: 'Could not sign in',
  loginInvalid: 'Wrong email or password.',
  loginNotStaff: 'This account has no admin access.',
  loginDisabled: 'This account is blocked.',
  loginHint: 'Only admin accounts can sign in.',
  loginTagline: 'Wardrobes, outfits and the people behind them, in one place.',

  dashSubtitle: 'What is happening in WearWise, at a glance',
  totalUsers: 'Users',
  newToday: 'today',
  newThisWeek: 'New this week',
  activeUsers: 'Active users',
  last30Days: 'last 30 days',
  premiumUsers: 'Premium',
  guests: 'Guests',
  guestsSub: 'browsing without an account',
  blockedUsers: 'Blocked',
  totalGarments: 'Pieces uploaded',
  samplesSub: '{{n}} sample pieces not counted',
  totalOutfits: 'Outfits',
  savedSub: '{{n}} saved',
  totalWears: 'Worn',
  plansSub: '{{n}} upcoming plans',
  signupTrend: 'Sign-ups (30 days)',
  garmentCategories: 'Piece types',
  activity: 'Activity (30 days)',

  analyticsSubtitle: 'Users, wardrobes and outfits in numbers',
  days: '{{n}} days',
  signups: 'Sign-ups',
  guestVisits: 'Guest visits',
  looksAsked: 'Outfit requests',
  assistantAsks: 'AI stylist',
  wears: 'Wears logged',
  uploads: 'Pieces uploaded',
  activeInactive: 'Active / inactive',
  inactive: 'Inactive',
  active: 'Active',
  signInMethods: 'Sign-in method',
  plans: 'Plan',
  styles: 'Chosen style',
  occasions: 'Main occasion',
  colors: 'Top colours',
  feedback: 'Reactions to outfits',
  liked: 'Liked',
  disliked: 'Disliked',
  avgGarments: 'Pieces per user',
  onboarded: 'Finished onboarding',

  usersSubtitle: '{{n}} accounts',
  colUser: 'User',
  colMethod: 'Sign-in',
  colPlan: 'Plan',
  colCloset: 'Closet',
  colOutfits: 'Outfits',
  colWears: 'Worn',
  colJoined: 'Joined',
  colStatus: 'Status',
  kindMember: 'Members',
  kindGuest: 'Guests',
  kindBlocked: 'Blocked',
  sortNewest: 'Newest',
  sortOldest: 'Oldest',
  sortCloset: 'Largest closet',
  sortWears: 'Most worn',
  sortEmail: 'Email (A–Z)',
  guest: 'Guest',
  blocked: 'Blocked',
  free: 'Free',
  premium: 'Premium',
  noUsers: 'Nobody found',
  noName: 'No name',
  makePremium: 'Make premium',
  makeFree: 'Make free',
  block: 'Block',
  unblock: 'Unblock',
  deleteUser: 'Delete account',
  deleteConfirm: 'Delete {{who}}, their closet and photos for good?',
  joined: 'Joined',
  lastActive: 'Last active',
  style: 'Style',
  occasion: 'Occasion',
  location: 'Location',
  notOnboarded: 'Has not finished onboarding',
  countGarments: 'Pieces',
  countOutfits: 'Outfits',
  countSaved: 'Saved',
  countWears: 'Worn',
  countPlans: 'Plans',
  countLooks: 'Outfit requests',
  countAssistant: 'AI questions',
  countScans: 'Video scans',
  privacyNote: 'Privacy: a user\'s closet, photos, outfits and what they wore are never shown in the admin panel.',


  premiumSubtitle: 'Subscriptions. Billing is not connected yet; plans can be changed here.',
  freeUsers: 'Free',
  conversion: 'Premium share',
  premiumList: 'Premium users',
  noPremium: 'No premium users yet',
  priceNote: 'Price: $4.99 / month · $29.99 / year',

  cat_top: 'Top',
  cat_bottom: 'Bottom',
  cat_dress: 'Dress',
  cat_outerwear: 'Outerwear',
  cat_shoes: 'Shoes',
  cat_accessory: 'Accessory',
  cat_bag: 'Bag',
  method_email: 'Email',
  method_apple: 'Apple',
  method_google: 'Google',
  method_guest: 'Guest',
}

const DICTS: Record<Lang, Record<Key, string>> = { az: AZ, en: EN }

export type T = (key: Key, vars?: Record<string, string | number>) => string

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: T }>({
  lang: 'az',
  setLang: () => {},
  t: (k) => AZ[k],
})

export function LangProvider({ children }: { children: React.ReactNode }) {
  // Read from storage after mount: the server renders this too.
  const [lang, setLangState] = useState<Lang>('az')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY)
      if (saved === 'az' || saved === 'en') setLangState(saved)
    } catch {
      /* storage blocked: the default stands */
    }
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try { localStorage.setItem(STORE_KEY, next) } catch { /* nothing to do */ }
    if (typeof document !== 'undefined') document.documentElement.lang = next
  }, [])

  const t = useCallback<T>((key, vars) => {
    let out: string = DICTS[lang][key] ?? AZ[key] ?? String(key)
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        out = out.split(`{{${k}}}`).join(String(v))
      }
    }
    return out
  }, [lang])

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export function useLang() {
  return useContext(Ctx)
}

/** Just the translator, for the common case. */
export function useT(): T {
  return useContext(Ctx).t
}

/** A label for a value from the app's vocabulary (category, sign-in method), falling back to the raw value. */
export function useLabel() {
  const t = useT()
  return (prefix: 'cat' | 'method', value: string) => {
    const key = `${prefix}_${value}` as Key
    return key in AZ ? t(key) : value.replace(/_/g, ' ')
  }
}
