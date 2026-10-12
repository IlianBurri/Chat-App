import { describe, expect, it } from 'vitest';
import { computeStatus } from './presence';

const base = { online: true, idle: false, inCall: false, manual: null };

describe('computeStatus', () => {
  it('is offline without connections, even with a manual status', () => {
    expect(computeStatus({ ...base, online: false, manual: 'dnd' })).toBe('offline');
  });

  it('is available when online and active', () => {
    expect(computeStatus(base)).toBe('available');
  });

  it('becomes away when idle and busy during a call', () => {
    expect(computeStatus({ ...base, idle: true })).toBe('away');
    expect(computeStatus({ ...base, inCall: true })).toBe('busy');
    expect(computeStatus({ ...base, idle: true, inCall: true })).toBe('busy');
  });

  it('lets a manual status win over automatic ones', () => {
    expect(computeStatus({ ...base, idle: true, manual: 'available' })).toBe('available');
    expect(computeStatus({ ...base, inCall: true, manual: 'dnd' })).toBe('dnd');
    expect(computeStatus({ ...base, manual: 'offline' })).toBe('offline');
  });
});
