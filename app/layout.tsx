import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Grab Desktop Automation Agent',
  description:
    'Aplikasi RPA berbasis ADB, scrcpy, dan OCR untuk mengelola data POI dari CSV serta membantu operator mengisi formulir Grab secara terkontrol dengan Assisted Mode dan checkpoint persisten.',
  openGraph: {
    title: 'Grab Desktop Automation Agent',
    description:
      'Aplikasi RPA berbasis ADB, scrcpy, dan OCR untuk mengelola data POI dari CSV dan membantu operator mengisi formulir Grab secara terkontrol.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grab Desktop Automation Agent',
    description:
      'Aplikasi RPA berbasis ADB, scrcpy, dan OCR untuk mengelola data POI dari CSV dan membantu operator mengisi formulir Grab secara terkontrol.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#F8FAFC] text-slate-900 antialiased dark:bg-[#0B111A] dark:text-slate-100"
      >
        {children}
      </body>
    </html>
  );
}
