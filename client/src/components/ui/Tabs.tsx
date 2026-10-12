import clsx from 'clsx';
import { PlusIcon } from '@phosphor-icons/react';
import type { KeyboardEvent } from 'react';
import { IconButton } from './IconButton';

interface Tab {
  id: string;
  label: string;
  onSelect?: () => void;
}

interface TabsProps {
  label: string;
  tabs: Tab[];
  active: string;
  onChange?: (id: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  className?: string;
}

/** Header tabs (underline style) with arrow-key navigation and optional "+" button. */
export function Tabs({ label, tabs, active, onChange, onAdd, addLabel, className }: TabsProps) {
  const select = (tab: Tab) => {
    tab.onSelect?.();
    onChange?.(tab.id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[(index + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    next?.focus();
    e.preventDefault();
  };

  return (
    <div className={clsx('flex items-center gap-1 self-stretch', className)}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex h-full items-stretch gap-1">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab)}
              className={clsx(
                'relative px-2 text-sm outline-offset-[-2px]',
                selected ? 'font-semibold text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {tab.label}
              {selected && <span aria-hidden="true" className="absolute right-2 bottom-0 left-2 h-[3px] rounded-t-full bg-accent" />}
            </button>
          );
        })}
      </div>
      {onAdd && addLabel && <IconButton label={addLabel} icon={PlusIcon} size="sm" onClick={onAdd} />}
    </div>
  );
}
