import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '작심백일 · 자기계발 사진 인증 모임',
  description: '같은 목표를 가진 사람들과 오늘의 실천을 사진으로 나누고, 서로 시작할 힘을 얻는 자기계발 모임.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <div className="canvas-backdrop">
          <div className="mobile-shell">{children}</div>
        </div>
      </body>
    </html>
  );
}
