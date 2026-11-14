import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'First Month — Make room for both of you',
  description: 'Agree on your first month of shared expenses. A little clarity for your next big step together.',
  referrer: 'no-referrer',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
