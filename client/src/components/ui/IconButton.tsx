import clsx from 'clsx';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Tooltip } from './Tooltip';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  icon: PhosphorIcon;
  size?: 'sm' | 'md';
  active?: boolean;
  tooltipSide?: 'top' | 'bottom' | 'right' | 'left';
}

/** Icon-only button with accessible name and tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon: Icon, size = 'md', active = false, tooltipSide = 'bottom', className, ...props },
  ref,
) {
  return (
    <Tooltip label={label} side={tooltipSide}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={clsx(
          'inline-flex items-center justify-center rounded-md transition-colors disabled:opacity-40',
          size === 'sm' ? 'size-7' : 'size-8',
          active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-fg',
          className,
        )}
        {...props}
      >
        <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} aria-hidden="true" />
      </button>
    </Tooltip>
  );
});
