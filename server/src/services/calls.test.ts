import { describe, expect, it } from 'vitest';
import { CallRegistry, parseTarget, roomKey, sanitizeState } from './calls';

const state = { mic: true, camera: true, screen: false, hand: false };

describe('targets', () => {
  it('builds and validates room keys', () => {
    expect(roomKey({ kind: 'chat', id: 'c1' })).toBe('chat:c1');
    expect(parseTarget({ kind: 'meeting', id: 'm1' })).toEqual({ kind: 'meeting', id: 'm1' });
    expect(parseTarget({ kind: 'user', id: 'x' })).toBeNull();
    expect(parseTarget({ kind: 'chat', id: '' })).toBeNull();
    expect(parseTarget('chat:c1')).toBeNull();
  });
});

describe('sanitizeState', () => {
  it('takes only boolean flags it knows', () => {
    expect(sanitizeState({ mic: false, hand: true, evil: 1, camera: 'yes' }, state)).toEqual({ ...state, mic: false, hand: true });
    expect(sanitizeState(null, state)).toEqual(state);
  });
});

describe('CallRegistry', () => {
  const setup = () => {
    const registry = new CallRegistry();
    const call = registry.create({ target: { kind: 'chat', id: 'c1' }, callId: 'call1', initiatorId: 'anna', media: 'video', now: 1000 });
    return { registry, call };
  };

  it('tracks members per socket and ends the call when the last one leaves', () => {
    const { registry, call } = setup();
    call.ringing.add('ben');
    registry.addMember(call.key, { socketId: 's1', userId: 'anna', name: 'Anna', avatarUrl: null, ...state });
    registry.addMember(call.key, { socketId: 's2', userId: 'ben', name: 'Ben', avatarUrl: null, ...state });
    expect(call.ringing.has('ben')).toBe(false);
    expect(registry.callOfSocket('s2')?.callId).toBe('call1');
    expect(registry.isUserInCall('ben')).toBe(true);

    expect(registry.removeSocket('s2')).toMatchObject({ ended: false, member: { userId: 'ben' } });
    expect(registry.isUserInCall('ben')).toBe(false);
    expect(registry.removeSocket('s1')).toMatchObject({ ended: true });
    expect(registry.get('chat:c1')).toBeUndefined();
    expect(registry.removeSocket('s1')).toBeNull();
  });

  it('remembers everyone who joined, even after they left', () => {
    const { registry, call } = setup();
    registry.addMember(call.key, { socketId: 's1', userId: 'anna', name: 'Anna', avatarUrl: null, ...state });
    registry.addMember(call.key, { socketId: 's2', userId: 'ben', name: 'Ben', avatarUrl: null, ...state });
    registry.removeSocket('s2');
    expect([...call.everJoined]).toEqual(['anna', 'ben']);
  });

  it('caps the in-call chat', () => {
    const { registry, call } = setup();
    for (let i = 0; i < 250; i++) registry.addChat(call, { id: String(i), userId: 'anna', text: 't', at: i });
    expect(call.chat).toHaveLength(200);
    expect(call.chat[0].id).toBe('50');
  });
});
