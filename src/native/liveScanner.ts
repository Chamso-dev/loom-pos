/**
 * Short confirmation beep via Web Audio (no asset needed). Used by the embedded
 * cart scanner to acknowledge a successful scan.
 *
 * Note: the app intentionally does NOT use any full-screen / background camera
 * scanner. All live scanning happens inside the small embedded <video> box
 * (see EmbeddedScanner.tsx).
 */
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
  } catch {
    /* audio not available — silent */
  }
}
