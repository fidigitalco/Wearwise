'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useLang } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import {
  LayoutGrid, BarChart3, Users, Shirt, Crown, MessageSquare, Menu, X, Sun, Moon, ChevronDown, LogOut, ShoppingBag, Bug,
} from 'lucide-react'

const TOP_NAV = [
  { href: '/dashboard',           key: 'navDashboard', icon: LayoutGrid, exact: true },
  { href: '/dashboard/analytics', key: 'navAnalytics', icon: BarChart3,  exact: false },
  { href: '/dashboard/users',     key: 'navUsers',     icon: Users,      exact: false },
  { href: '/dashboard/products',  key: 'navProducts',  icon: ShoppingBag, exact: false },
] as const

const BOTTOM_NAV = [
  { href: '/dashboard/feedback', key: 'navFeedback', icon: MessageSquare },
  { href: '/dashboard/errors', key: 'navErrors', icon: Bug },
  { href: '/dashboard/premium', key: 'navPremium', icon: Crown },
] as const

/** One row of the rail. Active is a soft tint, not a filled block; the icon
 *  takes the row's colour when active and stays a quiet grey otherwise. */
const navRow = (active: boolean) =>
  `group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
   ${active
     ? 'bg-indigo-50 text-indigo-600 dark:text-indigo-700 font-medium'
     : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`
const navIcon = (active: boolean) =>
  `shrink-0 ${active ? '' : 'text-slate-500 group-hover:text-slate-700'}`

export default function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const { lang, setLang, t } = useLang()
  const { theme, setTheme } = useTheme()
  // Closed on a phone, always open from `md` up. Closing on every navigation
  // is the behaviour a drawer needs: tapping a link and being left staring at
  // the menu is the commonest way an off-canvas nav goes wrong.
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [path])

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    setUsername(localStorage.getItem('admin_name') ?? '')
    setEmail(localStorage.getItem('admin_email') ?? '')
  }, [])

  function logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    localStorage.removeItem('admin_email')
    router.replace('/login')
  }

  return (
    <>
      {/* The phone's top bar. Fixed, so the menu is reachable however far down
          a long table the reader has scrolled. */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-card border-b border-slate-200 flex items-center gap-3 px-4">
        <button
          onClick={() => setOpen(v => !v)}
          aria-label={t(open ? 'closeMenu' : 'openMenu')}
          aria-expanded={open}
          className="w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center shrink-0"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
        <span className="text-slate-900 font-semibold text-sm">WearWise</span>
        <span className="text-slate-400 text-xs truncate">{t('adminPanel')}</span>
      </div>

      {/* Tapping away closes it — on a phone the drawer covers the content, so
          there has to be a way out that is not the button. */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-slate-900/30"
          aria-hidden
        />
      )}

    <aside className={`w-60 bg-card border-r border-slate-200 flex flex-col shrink-0 z-50
      fixed inset-y-0 left-0 transition-transform duration-200
      ${open ? 'translate-x-0' : '-translate-x-full'}
      md:static md:translate-x-0 md:min-h-screen`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-200">
        <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 text-white">
          <Shirt size={16} strokeWidth={2.25} />
        </div>
        <div>
          <div className="text-slate-900 font-semibold text-sm leading-tight">WearWise</div>
          <div className="text-slate-400 text-xs">{t('adminPanel')}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {/* Top nav items */}
        {TOP_NAV.map(n => {
          const active = n.exact ? path === n.href : path.startsWith(n.href)
          return (
            <Link
              key={n.href}
              href={n.href}
              className={navRow(active)}
            >
              <n.icon size={18} strokeWidth={1.75} className={navIcon(active)} />
              {t(n.key)}
            </Link>
          )
        })}

        {/* Divider */}
        <div className="my-3 mx-3 border-t border-slate-200" />

        {/* Bottom nav items */}
        {BOTTOM_NAV.map(n => {
          const active = path.startsWith(n.href)
          return (
            <Link
              key={n.href}
              href={n.href}
              className={navRow(active)}
            >
              <n.icon size={18} strokeWidth={1.75} className={navIcon(active)} />
              <span className="flex-1">{t(n.key)}</span>
            </Link>
          )
        })}
      </nav>

      {/* Appearance and language, on one line at the foot of the rail.
          The language was two full-width buttons; it is a select now, because
          it is a setting somebody touches once and not a switch worth a row of
          its own. The theme keeps a button: one tap, and the icon IS the
          state. */}
      <div className="px-4 pb-1 flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={t('appearance')}
          title={t(theme === 'dark' ? 'themeLight' : 'themeDark')}
          className="w-9 h-9 shrink-0 grid place-items-center rounded-lg border border-slate-200
                     text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">{t('language')}</span>
          <select
            value={lang}
            onChange={e => setLang(e.target.value as 'az' | 'en')}
            className="w-full appearance-none h-9 pl-3 pr-7 rounded-lg border border-slate-200 bg-card
                       text-xs font-medium text-slate-700 cursor-pointer
                       hover:bg-slate-100 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {/* The options are drawn by the OS, which does not inherit any of
                the above — hence the explicit colours, or an admin on a light
                system gets white-on-white. */}
            <option value="az" className="bg-card text-slate-900">Azərbaycan · AZ</option>
            <option value="en" className="bg-card text-slate-900">English · EN</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </label>
      </div>

      {/* User + Logout */}
      <div className="p-4 mt-3 border-t border-slate-200">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-xs text-indigo-600 dark:text-indigo-700 font-semibold shrink-0">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-slate-900 text-xs font-medium truncate">{username}</div>
            <div className="text-slate-500 text-xs truncate">{email}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-sm transition-colors"
        >
          <LogOut size={18} strokeWidth={1.75} className="text-slate-500 group-hover:text-slate-700" /> {t('logout')}
        </button>
      </div>
    </aside>
    </>
  )
}
