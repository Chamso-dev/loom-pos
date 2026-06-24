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

## Roadmap (next phases)

- Camera-based barcode scanning (replace HID scanner) via an ML Kit / ZXing plugin.
- Bluetooth ESC/POS thermal receipt printing.
- Data backup/restore and CSV export from the device.
