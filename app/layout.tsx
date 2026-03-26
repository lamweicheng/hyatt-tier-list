import './globals.css';
import type { Metadata } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import { ReactNode } from 'react';

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800']
});

const display = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700']
});

export const metadata: Metadata = {
  title: 'My Hyatt Tier List',
  description: 'Rank Hyatt hotels by tier with a polished interface and future-ready persistence.',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: '/favicon.png'
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'My Hyatt Tier List',
    description: 'Curate your own Hyatt tier list across the full brand portfolio.',
    images: ['/favicon.png']
  },
  twitter: {
    title: 'My Hyatt Tier List',
    card: 'summary',
    images: ['/favicon.png']
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} min-h-screen font-[family:var(--font-sans)] antialiased`}>
        {children}
      </body>
    </html>
  );
}