import type { LucideIcon } from 'lucide-react';

/** Full-width section shell for apps that are built in later milestones. */
export function PlaceholderView({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <main className="flex flex-1 flex-col overflow-hidden rounded-tl-lg bg-main">
      <header className="flex h-14 shrink-0 items-center border-b border-line px-5">
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>
      <EmptyState icon={Icon} title={title} text={text} />
    </main>
  );
}

export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="size-8" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted">{text}</p>
    </div>
  );
}
