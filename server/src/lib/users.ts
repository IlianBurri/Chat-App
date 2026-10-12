import { presence, type Status } from '../services/presence';

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  jobTitle: true,
  manualStatus: true,
  statusMessage: true,
} as const;

interface UserRow {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  manualStatus: string | null;
  statusMessage: string | null;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  status: Status;
  statusMessage: string | null;
}

export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    jobTitle: user.jobTitle,
    status: presence.statusOf(user.id, user.manualStatus),
    statusMessage: user.statusMessage,
  };
}

/** The signed-in user additionally sees whether their status is manual. */
export function toMe(user: UserRow) {
  return { ...toPublicUser(user), manualStatus: user.manualStatus };
}
