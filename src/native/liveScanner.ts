/**
 * Continuous (loop-based) live barcode scanning for the Cart screen on native.
 *
 * Uses @capacitor-mlkit/barcode-scanning's startScan/stopScan, which renders the
 * camera preview *behind* the webview. The webview is made see-through by adding
 * the `scanner-active` class to <html> (see index.css), so the basket UI floats
 * on top of the live camera. On web this is unsupported and callers fall back to
 * the manual / HID scanner.
 */
import { Capacitor } from '@capacitor/core';

export function isLiveScanSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export interface LiveScanHandle {
  stop: () => Promise<void>;
}

/**
 * Starts continuous scanning. `onBarcode` fires for every decoded barcode (the
 * caller is responsible for de-duping rapid repeats). Returns a handle whose
 * stop() tears everything down and restores the opaque UI.
 */
export async function startLiveScan(onBarcode: (value: string) => void): Promise<LiveScanHandle> {
  const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');

  const supported = await BarcodeScanner.isSupported();
  if (!supported.supported) throw new Error('Barcode scanning is not supported on this device.');

  const permission = await BarcodeScanner.requestPermissions();
  if (permission.camera !== 'granted' && permission.camera !== 'limited') {
    throw new Error('Camera permission was not granted.');
  }

  const listener = await BarcodeScanner.addListener('barcodesScanned', (event: any) => {
    const barcodes = event?.barcodes || [];
    for (const b of barcodes) {
      const value = b?.rawValue;
      if (value) onBarcode(String(value).trim());
    }
  });

  document.documentElement.classList.add('scanner-active');
  await BarcodeScanner.startScan();

  let stopped = false;
  return {
    stop: async () => {
      if (stopped) return;
      stopped = true;
      document.documentElement.classList.remove('scanner-active');
      try { await listener.remove(); } catch { /* ignore */ }
      try { await BarcodeScanner.stopScan(); } catch { /* ignore */ }
    },
  };
}

/** Short confirmation beep via Web Audio (no asset needed). */
let audioCtx: AudioContext | null = null;
export function scanBeep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch { /* audio not available — silent */ }
}
