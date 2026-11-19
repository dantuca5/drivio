import { Capacitor, registerPlugin } from '@capacitor/core';

/** Starea citirii automate, raportată de aplicația Android (pluginul nativ LiveReader). */
export interface LiveReaderStatus {
  serviceEnabled: boolean;
  captureEnabled: boolean;
  /** câte ecrane sunt înregistrate pe telefon */
  captures: number;
  bytes: number;
  uberInstalled: boolean;
  boltInstalled: boolean;
}

export interface LiveReaderPlugin {
  getStatus(): Promise<LiveReaderStatus>;
  openAccessibilitySettings(): Promise<void>;
  openAppDetails(): Promise<void>;
  openBatterySettings(): Promise<void>;
  setCaptureEnabled(o: { enabled: boolean }): Promise<void>;
  shareCaptures(): Promise<void>;
  clearCaptures(): Promise<void>;
  shareFile(o: { name: string; mime: string; data: string }): Promise<void>;
}

/** Doar în aplicația Android există serviciul de accesibilitate. */
export function isAndroidApp(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export const LiveReader = registerPlugin<LiveReaderPlugin>('LiveReader');

/** Conținutul unui fișier în base64, pentru puntea nativă. */
export async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
