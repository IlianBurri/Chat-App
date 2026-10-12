import type { Status } from '@/lib/types';

const COLORS: Record<Status, string> = {
  available: 'var(--tl-success)',
  busy: 'var(--tl-danger)',
  dnd: 'var(--tl-danger)',
  away: 'var(--tl-warning)',
  offline: 'var(--tl-offline)',
};

/**
 * Status glyph: green check (available), red dot (busy), red with bar (do not
 * disturb), yellow with clock (away), grey ring (offline).
 */
export function StatusIcon({ status, size = 10 }: { status: Status; size?: number }) {
  const color = COLORS[status];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      {status === 'offline' ? (
        <>
          <circle cx="8" cy="8" r="6.5" fill="var(--tl-bg-main)" stroke={color} strokeWidth="2.5" />
          <path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : (
        <circle cx="8" cy="8" r="8" fill={color} />
      )}
      {status === 'available' && (
        <path d="M4.6 8.3l2.2 2.2 4.6-4.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {status === 'dnd' && <rect x="4" y="7" width="8" height="2" rx="1" fill="#fff" />}
      {status === 'away' && (
        <path d="M8 4.5V8.3L10.4 9.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
