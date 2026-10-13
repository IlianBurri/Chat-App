import clsx from 'clsx';
import { DownloadSimpleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fileUrl, formatFileSize, isImage } from '@/lib/files';
import type { FileDto } from '@/lib/types';
import { FileIcon } from './FileIcon';
import { ImageViewer } from './ImageViewer';

/** Attachments under a message, post or reply: image previews and file cards. */
export function Attachments({ files, className }: { files: FileDto[]; className?: string }) {
  const { t } = useTranslation();
  const [viewing, setViewing] = useState<FileDto | null>(null);
  if (files.length === 0) return null;
  const images = files.filter((f) => isImage(f.mimeType));
  const others = files.filter((f) => !isImage(f.mimeType));

  return (
    <div className={clsx('mt-1.5 flex flex-col gap-1.5', className)}>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setViewing(f)}
              aria-label={t('files.openImage', { name: f.name })}
              className="overflow-hidden rounded-md border border-line bg-main outline-offset-2"
            >
              <img
                src={fileUrl(f.id)}
                alt={f.name}
                loading="lazy"
                className={clsx('block object-cover', images.length === 1 ? 'max-h-60 max-w-full' : 'size-32')}
              />
            </button>
          ))}
        </div>
      )}
      {others.map((f) => (
        <FileCard key={f.id} file={f} />
      ))}
      <ImageViewer file={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

export function FileCard({ file }: { file: FileDto }) {
  const { t, i18n } = useTranslation();
  return (
    <a
      href={fileUrl(file.id)}
      download={file.name}
      className="flex w-72 max-w-full items-center gap-3 rounded-md border border-line bg-main px-3 py-2 text-left hover:bg-hover"
    >
      <FileIcon mimeType={file.mimeType} name={file.name} className="size-8" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{file.name}</span>
        <span className="block text-xs text-muted">{formatFileSize(file.size, i18n.resolvedLanguage)}</span>
      </span>
      <DownloadSimpleIcon className="size-4 shrink-0 text-muted" aria-label={t('files.download')} />
    </a>
  );
}
