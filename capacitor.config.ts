import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.getquarterback.app',
  appName: 'Quarterback Health',
  webDir: 'out',
  server: {
    // Point to live site for development/testing
    url: 'https://www.getquarterback.com',
    cleartext: true,
    allowNavigation: ['*.plaid.com'],
  },
};

export default config;
