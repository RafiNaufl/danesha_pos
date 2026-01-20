import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.danesha.pos',
  appName: 'POS Danesha',
  webDir: 'public',
  server: {
    url: 'https://danesha-pos.vercel.app',
    cleartext: true,
    allowNavigation: ['danesha-pos.vercel.app', '*.vercel.app']
  }
};

export default config;
