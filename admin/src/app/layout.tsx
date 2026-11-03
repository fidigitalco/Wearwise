import type { Metadata } from 'next'
import './globals.css'
import { LangProvider } from '@/lib/i18n'
import { THEME_BOOT_SCRIPT, ThemeProvider } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'WearWise Admin',
  description: 'WearWise Admin Panel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // lang="az" is the default the panel was written in; LangProvider rewrites
  // it on the client when the reader has chosen English.
  return (
    <html lang="az">
      <head>
        {/* Before the first paint, so a dark panel never flashes white on the
            way in — see THEME_BOOT_SCRIPT. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <LangProvider>{children}</LangProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
