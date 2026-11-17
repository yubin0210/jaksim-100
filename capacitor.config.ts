export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    url?: string;
    cleartext?: boolean;
    androidScheme?: 'http' | 'https';
    allowNavigation?: string[];
  };
  ios?: {
    contentInset?: 'automatic' | 'scrollableAxes' | 'never' | 'always';
  };
  android?: {
    allowMixedContent?: boolean;
  };
  plugins?: Record<string, Record<string, unknown>>;
}

const config: CapacitorConfig = {
  appId: 'com.ongiboard.app',
  appName: '온기보드',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // Live Next.js API + SSR 모드 사용 시 배포된 서버 URL을 지정합니다:
    // url: 'https://your-ongi-board-server.example.com',
    // cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
