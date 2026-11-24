import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InsurTech Sales Coach',
  description: 'Харилцагч бүрт зориулсан даатгалын борлуулалтын AI коуч',
  icons: {
    icon: '/app-icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body>{children}</body>
    </html>
  );
}
