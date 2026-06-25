import { Capacitor } from '@capacitor/core'

/**
 * Native (Android/iOS) continuous barcode scanning via Google ML Kit.
 *
 * ML Kit decodes frames straight from the platform camera (camera2), which is
 * why it reads reliably where in-WebView JS decoders fail: the WebView often
 * refuses to hand camera pixels to a <canvas>, so BarcodeDetector/ZXing only
 * ever see a black frame. ML Kit bypasses that entirely.
 *
 * While scanning, the plugin renders the camera FULL-SCREEN behind a
 * transparent WebView. We add the `scan-window-active` class to <html>; the CSS
 * in index.css then makes the app chrome transparent and paints everything
 * opaque again EXCEPT the small scanner card, so the user sees a compact
 * scanner window — not a full-screen camera — while ML Kit still gets the whole
 * frame.
 */
export interface MlkitScanHandle {
  stop: () => Promise<void>
}

export function isMlkitAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

export async function startMlkitScan(onBarcode: (value: string) => void): Promise<MlkitScanHandle> {
  const { BarcodeScanner, BarcodeFormat, LensFacing } = await import('@capacitor-mlkit/barcode-scanning')

  const supported = await BarcodeScanner.isSupported()
  if (!supported.supported) throw new Error('mlkit-unsupported')

  const perm = await BarcodeScanner.requestPermissions()
  if (perm.camera !== 'granted' && perm.camera !== 'limited') {
    throw new Error('camera-permission-denied')
  }

  // On Android the on-device scanner module may need a one-time install.
  try {
    const mod = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
    if (!mod.available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => {})
    }
  } catch { /* not all platforms expose this; ignore */ }

  const listener = await BarcodeScanner.addListener('barcodesScanned', (event) => {
    for (const b of event.barcodes) {
      const value = (b.rawValue || b.displayValue || '').trim()
      if (value) {
        console.log('[scanner] barcode decoded:', value, '(', b.format, ')')
        onBarcode(value)
      }
    }
  })

  document.documentElement.classList.add('scan-window-active')

  await BarcodeScanner.startScan({
    lensFacing: LensFacing.Back,
    formats: [
      BarcodeFormat.Ean13,
      BarcodeFormat.Ean8,
      BarcodeFormat.UpcA,
      BarcodeFormat.UpcE,
      BarcodeFormat.Code128,
      BarcodeFormat.Code39,
      BarcodeFormat.Code93,
      BarcodeFormat.Itf,
      BarcodeFormat.Codabar,
      BarcodeFormat.QrCode,
      BarcodeFormat.DataMatrix,
    ],
  })
  console.log('[scanner] ML Kit camera started (full-screen behind UI)')

  return {
    stop: async () => {
      try { await BarcodeScanner.stopScan() } catch { /* already stopped */ }
      try { await listener.remove() } catch { /* noop */ }
      document.documentElement.classList.remove('scan-window-active')
      console.log('[scanner] ML Kit camera stopped, resources released')
    },
  }
}
