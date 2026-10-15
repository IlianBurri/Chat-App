import clsx from 'clsx';
import { PaperclipIcon, UploadSimpleIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/ui/IconButton';
import { formatFileSize } from '@/lib/files';
import { FileIcon } from './FileIcon';
import type { AttachmentsState } from './useAttachments';

/** Pending attachments above the composer's toolbar, with progress and remove buttons. */
export function AttachmentTray({ attachments }: { attachments: AttachmentsState }) {
  const { t, i18n } = useTranslation();
  if (attachments.items.length === 0) return null;

  return (
    <ul aria-label={t('files.attachments')} className="flex flex-wrap gap-2 px-3 pt-2">
      {attachments.items.map((item) => (
        <li
          key={item.key}
          className={clsx(
            'relative flex w-56 items-center gap-2 overflow-hidden rounded-md border bg-main py-1.5 pr-1 pl-2',
            item.status === 'error' ? 'border-danger' : 'border-line',
          )}
        >
          {item.previewUrl ? (
            <img src={item.previewUrl} alt="" className="size-8 shrink-0 rounded object-cover" />
          ) : (
            <FileIcon mimeType={item.mimeType} name={item.name} />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">{item.name}</span>
            <span className={clsx('flex items-center gap-1 text-[11px]', item.status === 'error' ? 'text-danger' : 'text-muted')}>
              {item.status === 'error' && <WarningCircleIcon className="size-3" aria-hidden="true" />}
              {item.status === 'uploading'
                ? t('files.uploading', { percent: Math.round(item.progress * 100) })
                : item.status === 'error'
                  ? t('files.failed')
                  : formatFileSize(item.size, i18n.resolvedLanguage)}
            </span>
          </span>
          <IconButton label={t('files.remove', { name: item.name })} icon={XIcon} size="sm" onClick={() => attachments.remove(item.key)} />
          {item.status === 'uploading' && (
            <span
              role="progressbar"
              aria-label={item.name}
              aria-valuenow={Math.round(item.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="absolute right-0 bottom-0 left-0 h-0.5 bg-line"
            >
              <span className="block h-full bg-accent transition-[width]" style={{ width: `${item.progress * 100}%` }} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Paperclip button with a hidden file input. */
export function AttachButton({ attachments }: { attachments: AttachmentsState }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const open = () => inputRef.current?.click();
  return (
    <>
      <IconButton label={t('composer.attach')} icon={PaperclipIcon} size="sm" onClick={open} />
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) attachments.add(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

/** Overlay while files are dragged over a composer. */
export function DropOverlay({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-accent bg-accent-soft/90 text-sm font-semibold text-accent">
      <UploadSimpleIcon className="size-5" aria-hidden="true" />
      {t('files.dropHere')}
    </div>
  );
}
