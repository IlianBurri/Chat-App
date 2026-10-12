import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
        variant === 'primary' && 'bg-accent text-accent-fg hover:bg-accent-hover',
        variant === 'secondary' && 'border border-line bg-main text-fg hover:bg-hover',
        variant === 'ghost' && 'text-fg hover:bg-hover',
        variant === 'danger' && 'bg-danger text-white hover:opacity-90',
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />}
      {children}
    </button>
  );
});
