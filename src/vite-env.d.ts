/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'mock' | 'gas';
  readonly VITE_TEST_DEVICE_API_URL?: string;
  readonly VITE_TEST_LINE_API_URL?: string;
  readonly VITE_TEST_PLATFORM_API_URL?: string;
  readonly VITE_TEST_GAS_URL?: string;
  readonly VITE_PROD_DEVICE_API_URL?: string;
  readonly VITE_PROD_LINE_API_URL?: string;
  readonly VITE_PROD_PLATFORM_API_URL?: string;
  readonly VITE_PROD_GAS_URL?: string;
  readonly VITE_DEVICE_API_KEY_ID?: string;
  readonly VITE_LINE_CHANNEL_KEY_ID?: string;
  readonly VITE_PLATFORM_API_KEY_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
