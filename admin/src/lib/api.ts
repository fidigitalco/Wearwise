const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function token() {
  return typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
}

/** An Error that also carries the server's error code, where it sent one. */
export interface ApiError extends Error {
  code?: string
  status?: number
  /** Per-field problems from a form the server refused: {url: 'search' | 'invalid', name: 'required', …}. */
  fields?: Record<string, string>
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const t = token()
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Token ${t}` } : {}),
      ...opts?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; detail?: string; code?: string; fields?: Record<string, string> }
    const err = new Error(body.error ?? body.detail ?? `HTTP ${res.status}`) as ApiError
    if (body.code) err.code = body.code
    if (body.fields) err.fields = body.fields
    err.status = res.status
    // A token that stopped working (signed out elsewhere, staff taken away): back to sign-in.
    if ((res.status === 401 || res.status === 403) && t && typeof window !== 'undefined' && !path.endsWith('/login/')) {
      localStorage.removeItem('admin_token')
      window.location.replace('/login')
    }
    throw err
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Stats {
  total_users: number
  guests: number
  new_today: number
  new_this_week: number
  active_users: number
  premium_users: number
  blocked_users: number
  garments: number
  sample_garments: number
  outfits: number
  saved_outfits: number
  wears: number
  plans: number
  open_feedback: number
  affiliate_clicks: number
  open_errors: number
  seen_today: number
}

export interface ChartPoint { name: string; value: number }
export interface TrendData { labels: string[]; data: number[] }

export interface Analytics {
  signups: TrendData
  guests: TrendData
  looks: TrendData
  assistant: TrendData
  wears: TrendData
  uploads: TrendData
  clicks: TrendData
  stores: ChartPoint[]
  active_inactive: ChartPoint[]
  providers: ChartPoint[]
  plans: ChartPoint[]
  styles: ChartPoint[]
  occasions: ChartPoint[]
  categories: ChartPoint[]
  colors: ChartPoint[]
  feedback: ChartPoint[]
  platforms: ChartPoint[]
  versions: ChartPoint[]
  device_countries: ChartPoint[]
  ip_countries: ChartPoint[]
  install_sources: ChartPoint[]
  avg_garments: number
  onboarded: number
  total: number
}

export type Provider = 'email' | 'apple' | 'google' | 'guest'

export interface UserRow {
  id: number
  email: string
  name: string
  provider: Provider
  plan: 'free' | 'premium'
  is_guest: boolean
  is_active: boolean
  onboarded: boolean
  date_joined: string
  garments: number
  outfits: number
  wears: number
  /** What the app reports about itself (X-Platform, X-App-Version, X-Country) and where its address is. */
  platform: 'ios' | 'android' | 'web' | 'unknown'
  app_version: string
  device_country: string
  ip_country: string
  last_seen_at: string | null
  /** Google Play install referrer's utm_source (Android), or '' when none came. */
  install_source: string
}

export interface Page<T> { results: T[]; count: number; page: number; pages: number }

/** One account as counts only: their closet, outfits and wear history are private and never sent. */
export interface UserDetail extends Omit<UserRow, 'garments' | 'outfits' | 'wears'> {
  last_active: string | null
  style_direction: string
  main_occasion: string
  favorite_colors: string[]
  sizes: Record<string, string>
  location: [number, number] | null
  install_medium: string
  install_campaign: string
  shop_country: string
  counts: {
    crashes: number
    garments: number; samples: number; outfits: number; saved: number; wears: number
    plans: number; looks_asked: number; assistant: number; scans: number
  }
}

export interface FeedbackRow {
  id: number
  kind: 'idea' | 'problem' | 'other'
  message: string
  platform: string
  app_version: string
  resolved: boolean
  created_at: string
  user: { id: number; email: string; name: string; is_guest: boolean } | null
}

export interface PremiumData {
  premium: number
  free: number
  conversion: number
  users: UserRow[]
}

export interface ProductRow {
  id: string
  name: string
  store: string
  brand: string
  price: number
  currency: string
  category: string
  subcategory: string
  color: string
  gender: 'women' | 'men' | 'unisex'
  image_url: string
  url: string
  active: boolean
  is_demo: boolean
  created_at: string
}

export interface ProductMeta {
  categories: { id: string; subs: { id: string; az: string; en: string }[] }[]
  colors: { id: string; az: string; en: string; rgb: [number, number, number] }[]
  genders: string[]
  currencies: string[]
}

export type ProductForm = Pick<ProductRow, 'url' | 'name' | 'brand' | 'store' | 'currency' | 'subcategory' | 'color' | 'gender' | 'image_url'> & { price: string }

export interface UserQuery {
  q?: string
  plan?: string
  kind?: string
  provider?: string
  platform?: string
  country?: string
  source?: string
  sort?: string
  page?: number
}

export interface ErrorRow {
  id: number
  kind: 'crash' | 'server'
  message: string
  /** The JS stack of a crash, or the Python traceback of a server error. */
  detail: string
  resolved: boolean
  count: number
  created_at: string
  last_seen_at: string
  user: { id: number; email: string } | null
  platform?: string
  app_version?: string
  device?: string
  fatal?: boolean
  endpoint?: string
  method?: string
  level?: string
}

export interface ErrorsPage extends Page<ErrorRow> {
  open: { crash: number; server: number }
  crashes_by_version: ChartPoint[]
  daily: { crash: TrendData; server: TrendData }
}

const qs = (params: Record<string, string | number | undefined>) => {
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') out.set(k, String(v))
  const s = out.toString()
  return s ? `?${s}` : ''
}

// ── Calls ──────────────────────────────────────────────────────────────────

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; name: string; email: string }>('/api/admin/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  stats: () => req<Stats>('/api/admin/stats/'),
  analytics: (days = 30) => req<Analytics>(`/api/admin/analytics/${qs({ days })}`),
  users: (q: UserQuery) => req<Page<UserRow>>(`/api/admin/users/${qs({ ...q })}`),
  user: (id: number) => req<UserDetail>(`/api/admin/users/${id}/`),
  updateUser: (id: number, patch: { plan?: 'free' | 'premium'; is_active?: boolean }) =>
    req<UserDetail>(`/api/admin/users/${id}/`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteUser: (id: number) => req<void>(`/api/admin/users/${id}/`, { method: 'DELETE' }),
  premium: () => req<PremiumData>('/api/admin/premium/'),
  feedback: (q: { status?: string; kind?: string; page?: number }) =>
    req<Page<FeedbackRow> & { open: number }>(`/api/admin/feedback/${qs({ ...q })}`),
  updateFeedback: (id: number, resolved: boolean) =>
    req<FeedbackRow>(`/api/admin/feedback/${id}/`, { method: 'PATCH', body: JSON.stringify({ resolved }) }),
  deleteFeedback: (id: number) => req<void>(`/api/admin/feedback/${id}/`, { method: 'DELETE' }),
  errors: (q: { kind: string; status?: string; page?: number }) =>
    req<ErrorsPage>(`/api/admin/errors/${qs({ ...q })}`),
  updateError: (kind: string, id: number, resolved: boolean) =>
    req<ErrorRow>(`/api/admin/errors/${kind}/${id}/`, { method: 'PATCH', body: JSON.stringify({ resolved }) }),
  deleteError: (kind: string, id: number) => req<void>(`/api/admin/errors/${kind}/${id}/`, { method: 'DELETE' }),
  products: (q: { q?: string; kind?: string; page?: number }) =>
    req<Page<ProductRow> & { real: number; demo: number }>(`/api/admin/products/${qs({ ...q })}`),
  productMeta: () => req<ProductMeta>('/api/admin/products/meta/'),
  guessProduct: (url: string) =>
    req<{ store: string; subcategory: string | null; color: string | null; search: boolean }>('/api/admin/products/guess/', {
      method: 'POST', body: JSON.stringify({ url }),
    }),
  addProduct: (form: ProductForm) =>
    req<ProductRow>('/api/admin/products/', { method: 'POST', body: JSON.stringify(form) }),
  updateProduct: (id: string, patch: Partial<ProductForm> & { active?: boolean }) =>
    req<ProductRow>(`/api/admin/products/${id}/`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteProduct: (id: string) => req<void>(`/api/admin/products/${id}/`, { method: 'DELETE' }),
}
