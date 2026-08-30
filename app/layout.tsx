import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Scroll Sizer — Grab, drag, and reshape any window',
  description: 'Try the Scroll Sizer interaction: catch the nearest window corner, drag anywhere, and roll through monitor limits into a new aspect ratio.',
  openGraph: {
    title: 'Scroll Sizer — One chord. A whole new window.',
    description: 'Grab it. Drag it. Roll it into shape.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Scroll Sizer — Grab it. Drag it. Roll it into shape.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Scroll Sizer — One chord. A whole new window.',
    description: 'Grab it. Drag it. Roll it into shape.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
