import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, DM_Sans, IBM_Plex_Mono } from 'next/font/google'
import {AppearanceProvider} from '@/components/appearance'
import './globals.css'
import './material.css'

const bodyFont = DM_Sans({ subsets: ['latin'], variable: '--font-body', display:'swap' })
const displayFont = Bricolage_Grotesque({ subsets:['latin'], variable:'--font-display', display:'swap' })
const monoFont = IBM_Plex_Mono({ subsets:['latin'], weight:['400','500'], variable:'--font-technical', display:'swap' })

export const metadata: Metadata = {
  title: 'DocRAG — Chat with your documents',
  description:
    'Retrieval-Augmented Generation document assistant with hybrid search, inline citations, and RAG evaluation.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [{media:'(prefers-color-scheme: dark)',color:'#0A0D0F'},{media:'(prefers-color-scheme: light)',color:'#F4F3EF'}],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-background">
      <head>{/* Parser-blocking local bootstrap restores the palette before paint. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable} font-sans antialiased`}>
        <AppearanceProvider><a className="skip-link" href="#main-content">Skip to content</a>{children}</AppearanceProvider>
      </body>
    </html>
  )
}
