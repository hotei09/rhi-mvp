import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';

// 루트 폰트 — Inter (latin subset only)
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Recipient Health Index',
  description: 'RHI MVP — 캐나다 정부 자금 수혜 단체 건강성 지표 (5개 렌즈 통합 분석)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
