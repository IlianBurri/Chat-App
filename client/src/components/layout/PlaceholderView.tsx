import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

export function EmptyState({ icon: Icon, title, text }: { icon: PhosphorIcon; title: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="size-8" weight="light" aria-hidden="true" />
      </span>
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted">{text}</p>
    </div>
  );
}
