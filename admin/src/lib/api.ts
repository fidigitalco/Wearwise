const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function token() {
  return typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
}

/** An Error that also carries the server's error code, where it sent one. */
export interface ApiError extends Error {
  code?: string
  status?: number
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
    const body = await res.json().catch(() => ({})) as { error?: string; detail?: string; code?: string }
    const err = new Error(body.error ?? body.detail ?? `HTTP ${res.status}`) as ApiError
    if (body.code) err.code = body.code
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
  active_inactive: ChartPoint[]
  providers: ChartPoint[]
  plans: ChartPoint[]
  styles: ChartPoint[]
  occasions: ChartPoint[]
  categories: ChartPoint[]
  colors: ChartPoint[]
  feedback: ChartPoint[]
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
  counts: {
    garments: number; samples: number; outfits: number; saved: number; wears: number
    plans: number; looks_asked: number; assistant: number; scans: number
  }
}

export interface PremiumData {
  premium: number
  free: number
  conversion: number
  users: UserRow[]
}

export interface UserQuery {
  q?: string
  plan?: string
  kind?: string
  provider?: string
  sort?: string
  page?: number
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
}
