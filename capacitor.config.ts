import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.loompos.app',
  appName: 'LoomPOS',
  webDir: 'dist',
  backgroundColor: '#0b0f1a',
  android: {
    // Allow the offline app to keep working without any cleartext network access.
    allowMixedContent: false,
  },
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
};

export default config;
