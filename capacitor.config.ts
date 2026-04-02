import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.getquarterback.app',
  appName: 'Quarterback AI',
  webDir: 'out',
  server: {
    // Allow Plaid Link iframes to load inside the WKWebView
    allowNavigation: ['*.plaid.com'],
  },
};

export default config;
