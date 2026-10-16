let ctx: AudioContext | null = null;
let timer: number | null = null;

/** Two short tones every two seconds, generated on the fly (no audio file needed). */
function chime() {
  if (!ctx) return;
  const start = ctx.currentTime;
  for (const [offset, frequency] of [
    [0, 880],
    [0.25, 660],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.15, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start + offset);
    osc.stop(start + offset + 0.25);
  }
}

/** Plays while a call rings. Browsers may block sound until the page was clicked once; then it stays silent. */
export function startRingtone() {
  if (timer !== null) return;
  try {
    ctx ??= new AudioContext();
    void ctx.resume().catch(() => {});
    chime();
    timer = window.setInterval(chime, 2000);
  } catch {
    // No Web Audio: ringing is still visible.
  }
}

export function stopRingtone() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
}
