import type { Metadata, Viewport } from 'next';
import './globals.css';

const deploymentOrigin =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ding-ding-projects.github.io/nazca/';

export const metadata: Metadata = {
  metadataBase: new URL(deploymentOrigin),
  title: {
    default: 'Nazca Railway',
    template: '%s | Nazca Railway',
  },
  description:
    'A modern, searchable transit atlas and encyclopedia for Nazca Railway and Los Sengas.',
  applicationName: 'Nazca Railway',
  openGraph: {
    type: 'website',
    title: 'Nazca Railway',
    description:
      'A modern, searchable transit atlas and encyclopedia for Nazca Railway and Los Sengas.',
    siteName: 'Nazca Railway',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nazca Railway',
    description:
      'A modern, searchable transit atlas and encyclopedia for Nazca Railway and Los Sengas.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f7f8' },
    { media: '(prefers-color-scheme: dark)', color: '#101719' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
