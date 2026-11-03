'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { Shirt } from 'lucide-react'
import type { ApiError } from '@/lib/api'

export default function LoginPage() {
  const t = useT()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.login(email, password)
      localStorage.setItem('admin_token', res.token)
      localStorage.setItem('admin_name', res.name)
      localStorage.setItem('admin_email', res.email)
      router.replace('/dashboard')
    } catch (err) {
      // The server's code picks our own wording; its message is the fallback.
      const code = (err as ApiError)?.code
      setError(code === 'invalid' ? t('loginInvalid')
        : code === 'not_staff' ? t('loginNotStaff')
          : code === 'disabled' ? t('loginDisabled')
            : err instanceof Error ? err.message : t('loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    // The app's welcome photo on the left from `lg` up, the form on the page's own neutral.
    <div className="min-h-screen bg-slate-50 flex">
      <div className="hidden lg:block relative w-1/2 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/welcome.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-12 text-white">
          <div className="text-3xl font-semibold tracking-tight">WearWise</div>
          <p className="mt-2 max-w-sm text-sm text-white/80">{t('loginTagline')}</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full min-w-0 max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-11 h-11 bg-indigo-600 rounded-full mb-4 shadow-sm text-white">
            <Shirt size={20} strokeWidth={2.25} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">WearWise Admin</h1>
          <p className="text-slate-500 text-sm mt-1">{t('loginSubtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-xl border border-slate-200/80 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('loginEmail')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           placeholder:text-slate-400 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('loginPassword')}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           placeholder:text-slate-400 transition"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:brightness-90 disabled:opacity-60
                         text-white font-medium py-2.5 rounded-lg transition text-sm"
            >
              {loading ? t('loginBusy') : t('loginSubmit')}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            {t('loginHint')}
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}
