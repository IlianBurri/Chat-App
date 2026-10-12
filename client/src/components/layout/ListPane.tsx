import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LIST_WIDTH, useUiStore } from '@/stores/ui';

/** Second column; width adjustable by dragging or with arrow keys on the handle. */
export function ListPane({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useTranslation();
  const width = useUiStore((s) => s.listWidth);
  const setWidth = useUiStore((s) => s.setListWidth);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const onMove = (ev: globalThis.PointerEvent) => setWidth(startWidth + ev.clientX - startX);
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setWidth(width - 16);
    else if (e.key === 'ArrowRight') setWidth(width + 16);
    else if (e.key === 'Home') setWidth(LIST_WIDTH.min);
    else if (e.key === 'End') setWidth(LIST_WIDTH.max);
    else return;
    e.preventDefault();
  };

  return (
    <aside aria-label={label} className="relative flex shrink-0 flex-col rounded-tl-lg bg-pane" style={{ width }}>
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('listPane.resize')}
        aria-valuemin={LIST_WIDTH.min}
        aria-valuemax={LIST_WIDTH.max}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="absolute top-0 -right-1 bottom-0 z-10 w-2 cursor-col-resize outline-offset-[-2px] after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-line hover:after:w-0.5 hover:after:bg-accent"
      />
    </aside>
  );
}
