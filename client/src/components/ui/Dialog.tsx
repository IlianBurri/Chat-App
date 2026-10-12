import clsx from 'clsx';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from './IconButton';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

/** Modal dialog built on the native <dialog> element (focus trap and Escape for free). */
export function Dialog({ open, onClose, title, children, footer, width = 440 }: DialogProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={clsx(
        'm-auto max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-main p-0 text-fg shadow-pop backdrop:bg-black/40',
      )}
      style={{ width }}
    >
      {open && (
        <div className="flex flex-col">
          <header className="flex items-center justify-between gap-4 px-5 pt-4 pb-2">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <IconButton label={t('common.close')} icon={X} onClick={onClose} size="sm" />
          </header>
          <div className="px-5 pb-4">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
