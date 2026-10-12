import clsx from 'clsx';

/** Red counter badge; hidden for zero. */
export function Badge({ count, className, label }: { count: number; className?: string; label?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={clsx(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-bold text-white',
        className,
      )}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
