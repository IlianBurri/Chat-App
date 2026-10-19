import { initials } from '@/lib/format';
import type { WorkspaceSummary } from '@/lib/types';

/** Square workgroup logo, or coloured initials tile when there is none. */
export function WorkspaceTile({ workspace, size = 32 }: { workspace: Pick<WorkspaceSummary, 'name' | 'logoUrl' | 'color'>; size?: number }) {
  if (workspace.logoUrl) {
    return <img src={workspace.logoUrl} alt="" className="shrink-0 rounded-md object-cover" style={{ width: size, height: size }} />;
  }
  // Initials as generated content (see Avatar): the tile sits inside buttons named by their label.
  return (
    <span
      aria-hidden="true"
      data-initials={initials(workspace.name)}
      className="flex shrink-0 items-center justify-center rounded-md font-semibold text-white select-none before:content-[attr(data-initials)]"
      style={{ width: size, height: size, backgroundColor: workspace.color, fontSize: size * 0.4 }}
    />
  );
}
