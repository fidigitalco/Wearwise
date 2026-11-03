'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) {
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {/* pt-14 on a phone clears the fixed top bar the sidebar draws there;
          min-w-0 lets the wide tables inside scroll instead of stretching the
          page, which is what made every screen scroll sideways as a whole. */}
      <main className="flex-1 min-w-0 overflow-auto bg-slate-50 pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
