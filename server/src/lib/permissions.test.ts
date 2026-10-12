import { describe, expect, it } from 'vitest';
import { canSeeChannel, channelNameTaken, isRole, permissionsFor, wouldRemoveLastOwner } from './permissions';

describe('permissionsFor', () => {
  it('lets owners manage everything', () => {
    expect(Object.values(permissionsFor('owner')).every(Boolean)).toBe(true);
  });

  it('lets members edit notes but not manage the workgroup', () => {
    const p = permissionsFor('member');
    expect(p.editNotes).toBe(true);
    expect(p.manageChannels || p.manageMembers || p.manageWorkspace || p.moderate).toBe(false);
  });

  it('gives guests no extra rights', () => {
    expect(Object.values(permissionsFor('guest')).some(Boolean)).toBe(false);
  });
});

describe('isRole', () => {
  it('accepts known roles only', () => {
    expect(isRole('guest')).toBe(true);
    expect(isRole('admin')).toBe(false);
  });
});

describe('canSeeChannel', () => {
  it('hides private channels from non-members', () => {
    expect(canSeeChannel('standard', false)).toBe(true);
    expect(canSeeChannel('private', false)).toBe(false);
    expect(canSeeChannel('private', true)).toBe(true);
  });
});

describe('wouldRemoveLastOwner', () => {
  it('protects the last owner', () => {
    expect(wouldRemoveLastOwner('owner', 1, null)).toBe(true);
    expect(wouldRemoveLastOwner('owner', 1, 'member')).toBe(true);
    expect(wouldRemoveLastOwner('owner', 1, 'owner')).toBe(false);
  });

  it('allows changes when another owner remains or the target is no owner', () => {
    expect(wouldRemoveLastOwner('owner', 2, null)).toBe(false);
    expect(wouldRemoveLastOwner('member', 1, null)).toBe(false);
  });
});

describe('channelNameTaken', () => {
  const channels = [
    { id: 'c1', name: 'General' },
    { id: 'c2', name: 'Design' },
  ];

  it('compares trimmed names case-insensitively', () => {
    expect(channelNameTaken('  design ', channels)).toBe(true);
    expect(channelNameTaken('Marketing', channels)).toBe(false);
  });

  it('reserves the default channel name in every language', () => {
    expect(channelNameTaken('Allgemein', [])).toBe(true);
    expect(channelNameTaken('general', [])).toBe(true);
  });

  it('ignores the channel being renamed', () => {
    expect(channelNameTaken('design', channels, 'c2')).toBe(false);
  });
});
