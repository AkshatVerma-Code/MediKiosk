import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MedCase — AI Patient History System | SIH26047',
  description:
    'AI-powered patient case-taking kiosk for government hospitals. Collects patient history through conversational AI before doctor consultation. Ministry of Ayush — SIH26047.',
  keywords: ['patient history', 'AI case taking', 'AYUSH', 'SIH', 'kiosk', 'hospital'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2D7A3A" />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
