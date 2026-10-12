import { initials } from '@/lib/format';
import type { WorkspaceSummary } from '@/lib/types';

/** Square workgroup logo, or coloured initials tile when there is none. */
export function WorkspaceTile({ workspace, size = 32 }: { workspace: Pick<WorkspaceSummary, 'name' | 'logoUrl' | 'color'>; size?: number }) {
  if (workspace.logoUrl) {
    return <img src={workspace.logoUrl} alt="" className="shrink-0 rounded-md object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-md font-semibold text-white select-none"
      style={{ width: size, height: size, backgroundColor: workspace.color, fontSize: size * 0.4 }}
    >
      {initials(workspace.name)}
    </span>
  );
}
