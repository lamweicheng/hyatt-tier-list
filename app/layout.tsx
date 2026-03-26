import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { SessionDataProvider } from './SessionDataProvider';

export const metadata: Metadata = {
  title: 'Forecast Management System',
  description: 'Mock-up of AbbVie forecast management workflow',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: '/favicon.png'
  }
  ,
  // Provide a base URL for resolving open graph / twitter images. Use an env var in production.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Forecast Management Portal',
    description: 'Mock-up of AbbVie forecast management workflow',
    images: ['/favicon.png']
  },
  twitter: {
    title: 'Forecast Management Portal',
    card: 'summary',
    images: ['/favicon.png']
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-8xl p-10">
          <SessionDataProvider>{children}</SessionDataProvider>
        </div>
      </body>
    </html>
  );
}