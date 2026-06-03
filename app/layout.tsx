import type { Metadata } from 'next';
import { Hanken_Grotesk } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';

const hanken = Hanken_Grotesk({
  variable: '--font-hanken',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Slate Setter',
  description: 'Theatrical release planning tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hanken.variable}>
      <body style={{ fontFamily: 'var(--font-hanken), system-ui, sans-serif' }}>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
