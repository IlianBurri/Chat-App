import { networkInterfaces } from 'node:os';

/** Turns what people type ("192.168.1.20:4000", "chat.firma.ch/") into an origin, or null. */
export function normalizeServerUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `http://${text}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLoopback(hostname: string) {
  return hostname === 'localhost' || hostname === '[::1]' || /^127\./.test(hostname);
}

/**
 * Chromium only allows camera, microphone and screen sharing in secure contexts. A team server in the LAN
 * usually runs on plain http, so the shell marks exactly that origin as secure. Loopback is secure anyway.
 */
export function insecureOriginToAllow(origin: string | null): string | null {
  if (!origin) return null;
  const url = new URL(origin);
  return url.protocol === 'http:' && !isLoopback(url.hostname) ? url.origin : null;
}

/** IPv4 addresses on which colleagues in the LAN can reach this computer. */
export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))
    .map((a) => a!.address);
}

export type ServerCheck = { ok: true } | { ok: false; reason: 'unreachable' | 'not_hallo' };

/** Whether a Hallo server answers at the origin (its health route returns `{ ok: true }`). */
export async function checkServer(origin: string, timeoutMs = 6000): Promise<ServerCheck> {
  let response: Response;
  try {
    response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  try {
    const body = (await response.json()) as { ok?: unknown };
    return response.ok && body.ok === true ? { ok: true } : { ok: false, reason: 'not_hallo' };
  } catch {
    return { ok: false, reason: 'not_hallo' };
  }
}
