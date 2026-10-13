export const ROLES = ['owner', 'member', 'guest'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/**
 * What a role may do inside a workgroup. Everyone can read visible channels,
 * write posts and replies, react, and edit or delete their own content.
 */
export function permissionsFor(role: Role) {
  const owner = role === 'owner';
  return {
    /** Rename, change visibility or delete the workgroup */
    manageWorkspace: owner,
    /** Add and remove people, change roles */
    manageMembers: owner,
    /** Create, edit and delete channels, manage private channel members */
    manageChannels: owner,
    /** Delete other people's posts and replies */
    moderate: owner,
    /** Edit the channel notes */
    editNotes: role !== 'guest',
  };
}

export type Permissions = ReturnType<typeof permissionsFor>;

/** Private channels are visible to their members only; standard channels to the whole workgroup. */
export function canSeeChannel(channelType: string, isChannelMember: boolean) {
  return channelType !== 'private' || isChannelMember;
}

/**
 * A workgroup must always keep at least one owner, so the last owner can
 * neither leave, be removed, nor be demoted.
 */
export function wouldRemoveLastOwner(targetRole: string, ownerCount: number, nextRole: Role | null) {
  return targetRole === 'owner' && ownerCount <= 1 && nextRole !== 'owner';
}

/** Display names of the default channel in every supported language. */
export const RESERVED_CHANNEL_NAMES = ['general', 'allgemein'];

/** Channel names are unique per workgroup (trimmed, case-insensitive); the default channel's names are reserved. */
export function channelNameTaken(name: string, existing: { id: string; name: string }[], ignoreId?: string) {
  const key = name.trim().toLocaleLowerCase();
  if (RESERVED_CHANNEL_NAMES.includes(key)) return true;
  return existing.some((c) => c.id !== ignoreId && c.name.trim().toLocaleLowerCase() === key);
}
