# LoomPOS — Standalone Android App

LoomPOS now ships as a **fully offline Android APK** in addition to the web build.
The same React UI runs natively via [Capacitor](https://capacitorjs.com), and all
data lives **on the device** in SQLite — no server, no PostgreSQL, no internet
required.

## How it works

The web app talks to its backend exclusively through `fetch('/api/...')`. On the
native build we keep that contract but serve it locally:

```
React UI  ──fetch('/api/...')──►  offlineApi bridge (native only)
                                        │
                                        ▼
                              localApi router  ──►  SQLite (on device)
```

- **`src/native/db.ts`** — opens the on-device SQLite database, creates the schema
  (mirrors `prisma/schema.prisma`), and seeds the default admin + store settings.
- **`src/native/localApi.ts`** — re-implements every Express endpoint
  (auth, users, products, orders/checkout with transactional stock updates,
  settings, analytics) against SQLite, returning the exact JSON shapes the UI
  expects.
- **`src/native/offlineApi.ts`** — on a native platform, patches `window.fetch`
  so `/api/*` requests are answered by `localApi`. On the web it is a no-op, so
  `npm run dev` still uses the real Express/PostgreSQL backend.

Because the bridge is transparent, **no UI components or the Zustand store were
changed.** The web and mobile builds share 100% of the application code.

Default login on first launch: **`admin` / `admin123`**.

## Build the APK

Prerequisites: Node 18+, JDK 17, Android SDK (Android Studio).

```bash
# Install JS deps (Prisma is server-only; skip its native engine download)
npm install --ignore-scripts

# Build web assets, sync them into the native project, assemble the APK
npm run android:apk
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Or open the project in Android Studio:

```bash
npm run android:open
```

CI builds a debug APK automatically on every push (`.github/workflows/build-apk.yml`)
and uploads it as the `loompos-debug-apk` artifact.

## Hardware (native build)

These replace the PC peripherals the web build relied on. Both degrade
gracefully on the web — the controls simply don't appear off-device.

### Camera barcode scanning

The phone camera doubles as the barcode scanner via
[`@capacitor-mlkit/barcode-scanning`](https://github.com/capawesome-team/capacitor-mlkit)
(Google ML Kit). A camera button appears in the billing scanner field; tapping
it opens the scanner, and a decoded code flows through the **same** lookup as a
typed/HID scan (`src/native/scanner.ts` → `ScannerInput`). Codes not in the
catalogue are dropped back into the search box for the cashier. Requires the
`CAMERA` permission, requested on first use.

### Bluetooth thermal printing

Receipts print to a paired ESC/POS thermal printer over classic Bluetooth
(SPP/RFCOMM). On the thermal receipt preview a **Bluetooth Print** button lists
paired printers and sends the receipt:

- **`android/app/.../BluetoothPrinterPlugin.java`** — custom Capacitor plugin
  that opens an RFCOMM socket to the chosen device and writes the byte stream.
  (Most consumer thermal printers are classic SPP, not BLE.)
- **`src/native/escpos.ts`** — builds the ESC/POS byte stream from the order +
  store settings (32-column layout that prints cleanly on 58mm and 80mm).
- **`src/native/bluetoothPrinter.ts`** — typed JS bridge to the plugin.
- **`src/components/billing/BluetoothPrintButton.tsx`** — paired-device picker
  and print/status UI.

Pair the printer once in Android's Bluetooth settings; it then shows up in the
picker. Requires `BLUETOOTH_CONNECT` (Android 12+), requested on first use.

## Roadmap (next phases)

- Data backup/restore and CSV export from the device.
