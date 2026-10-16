/** "0:05", "12:03" or "1:02:03" for a running call. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Columns and rows for `count` tiles in a `width` × `height` area so that each
 * 16:9 tile is as large as possible.
 */
export function gridShape(count: number, width: number, height: number, gap = 8, aspect = 16 / 9) {
  if (count <= 0 || width <= 0 || height <= 0) return { cols: 1, rows: 1, tileWidth: 0, tileHeight: 0 };
  let best = { cols: 1, rows: count, tileWidth: 0, tileHeight: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const maxW = (width - gap * (cols - 1)) / cols;
    const maxH = (height - gap * (rows - 1)) / rows;
    const tileWidth = Math.min(maxW, maxH * aspect);
    if (tileWidth > best.tileWidth) best = { cols, rows, tileWidth, tileHeight: tileWidth / aspect };
  }
  return best;
}

/** Loudness 0…1 of an analyser's time-domain samples (128 = silence). */
export function rmsLevel(samples: Uint8Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const value of samples) {
    const centered = (value - 128) / 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / samples.length);
}

export interface SpeakingState {
  speaking: boolean;
  lastLoudAt: number;
}

/** Speaking starts above `threshold` and only stops after `holdMs` of quiet, so the frame does not flicker. */
export function nextSpeaking(prev: SpeakingState, level: number, now: number, threshold = 0.03, holdMs = 700): SpeakingState {
  if (level >= threshold) return { speaking: true, lastLoudAt: now };
  return { speaking: prev.speaking && now - prev.lastLoudAt < holdMs, lastLoudAt: prev.lastLoudAt };
}

/**
 * Who gets the big tile in speaker view: a screen share first, then a pinned
 * person, then whoever spoke last, otherwise the first other person.
 */
export function pickSpotlight<T extends { id: string; screen: boolean; self: boolean }>(
  tiles: T[],
  pinnedId: string | null,
  lastSpeakerId: string | null,
): T | undefined {
  return (
    tiles.find((t) => t.screen && !t.self) ??
    tiles.find((t) => t.screen) ??
    tiles.find((t) => t.id === pinnedId) ??
    tiles.find((t) => t.id === lastSpeakerId && !t.self) ??
    tiles.find((t) => !t.self) ??
    tiles[0]
  );
}
