/**
 * Over-the-air (OTA) update system.
 *
 * The app's features all live in the web bundle, so we ship feature changes by
 * updating that bundle on the device — no APK reinstall. Powered by the
 * open-source Capgo updater plugin, self-hosted against a static version
 * manifest published on our rolling GitHub release.
 *
 * Flow (offline-first, non-interruptive):
 *  1. On launch, mark the running bundle healthy (enables auto-rollback if a
 *     bad bundle ever fails to boot).
 *  2. Silently fetch the manifest in the background. If the latest version is
 *     newer than the one baked into this build, download the new bundle and
 *     verify its checksum.
 *  3. Apply it the next time the app goes to the background, so the user is
 *     never interrupted — the update is live on their next session.
 *  4. Old bundles are cleaned up automatically (current + one rollback kept).
 *
 * If the device is offline or no update exists, nothing happens and the app
 * keeps working entirely offline.
 */
import { Capacitor } from '@capacitor/core'

/** Version baked into this build (CI run number). 0 = local/dev build. */
const BAKED_VERSION = Number(import.meta.env.VITE_BUNDLE_VERSION || '0')

/** Static manifest describing the latest published web bundle. */
const MANIFEST_URL =
  (import.meta.env.VITE_UPDATE_MANIFEST_URL as string | undefined)?.trim() ||
  'https://github.com/Chamso-dev/loom-pos/releases/download/android-latest/latest.json'

interface UpdateManifest {
  version: number // CI run number — strictly increasing
  url: string // bundle .zip URL
  checksum: string // sha256 of the bundle, verified before applying
  critical?: boolean
}

export async function initLiveUpdates(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    const { App } = await import('@capacitor/app')

    // 1) Confirm the current bundle booted OK (prevents rollback of a good one).
    await CapacitorUpdater.notifyAppReady().catch(() => {})

    // 2) Background check — never blocks startup, never throws to the app.
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' })
    if (!res.ok) return
    const manifest = (await res.json()) as UpdateManifest
    if (!manifest?.version || !manifest.url || !manifest.checksum) return

    // Up to date (or older) → nothing to do; stay fully offline-capable.
    if (manifest.version <= BAKED_VERSION) return

    // 3) Download + checksum-verify the new bundle (rejected if corrupted).
    const bundle = await CapacitorUpdater.download({
      url: manifest.url,
      version: String(manifest.version),
      checksum: manifest.checksum,
    })

    // 4) Apply seamlessly the next time the app is backgrounded, so the new
    //    version is live on the next session without interrupting this one.
    const apply = async () => {
      try {
        await CapacitorUpdater.set(bundle)
        // Clean up obsolete bundles (keep current + rollback only).
        const { bundles } = await CapacitorUpdater.list()
        for (const b of bundles) {
          if (b.id !== bundle.id && b.status !== 'success') {
            await CapacitorUpdater.delete({ id: b.id }).catch(() => {})
          }
        }
      } catch {
        /* keep running the current bundle on any failure */
      }
    }

    // Apply on the next background transition (critical or not, the update is
    // downloaded silently and goes live next session — never mid-use).
    let applied = false
    App.addListener('appStateChange', (s) => {
      if (!s.isActive && !applied) { applied = true; apply() }
    })
  } catch {
    /* updater unavailable or network error — app continues offline as-is */
  }
}
