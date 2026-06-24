/**
 * Camera barcode scanning for the native Android build.
 *
 * Wraps @capacitor-mlkit/barcode-scanning so the rest of the app can scan a
 * barcode with one call. On the web (or any non-native platform) this is a
 * no-op that reports "unsupported", so callers can keep the keyboard/HID flow.
 */
import { Capacitor } from '@capacitor/core';

export interface ScanResult {
  /** True when a barcode was captured. */
  ok: boolean;
  /** The decoded barcode value (when ok). */
  value?: string;
  /** Why the scan did not produce a value (cancelled, denied, unsupported, error). */
  reason?: 'cancelled' | 'denied' | 'unsupported' | 'error';
  /** Human-readable detail for error/denied cases. */
  message?: string;
}

/** Whether camera scanning is available on this platform. */
export function isCameraScanSupported(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Opens the camera, scans a single barcode, and returns its value.
 * Handles permission prompts and the on-demand Google scanner module download.
 */
export async function scanBarcode(): Promise<ScanResult> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, reason: 'unsupported' };
  }

  try {
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');

    const supported = await BarcodeScanner.isSupported();
    if (!supported.supported) {
      return { ok: false, reason: 'unsupported', message: 'Barcode scanning is not supported on this device.' };
    }

    const permission = await BarcodeScanner.requestPermissions();
    if (permission.camera !== 'granted' && permission.camera !== 'limited') {
      return { ok: false, reason: 'denied', message: 'Camera permission was not granted.' };
    }

    // The scan() UI relies on Google's code scanner module, which Play Services
    // downloads on first use. Make sure it is present before scanning.
    const moduleAvailable = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!moduleAvailable.available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    }

    const { barcodes } = await BarcodeScanner.scan();
    const value = barcodes[0]?.rawValue?.trim();
    if (!value) {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: true, value };
  } catch (error: any) {
    const message: string = error?.message || String(error);
    // The plugin throws when the user backs out of the scanner UI.
    if (/cancel/i.test(message)) {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'error', message };
  }
}
