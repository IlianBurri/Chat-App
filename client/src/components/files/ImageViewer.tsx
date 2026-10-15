import { DownloadSimpleIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui/Dialog';
import { fileUrl, formatFileSize } from '@/lib/files';
import type { FileDto } from '@/lib/types';

/** Large image preview with a download button. */
export function ImageViewer({ file, onClose }: { file: FileDto | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <Dialog
      open={file !== null}
      onClose={onClose}
      title={file?.name ?? ''}
      width={960}
      footer={
        file && (
          <div className="flex w-full items-center justify-between gap-2 text-sm text-muted">
            <span>
              {file.uploader.name} · {formatFileSize(file.size, i18n.resolvedLanguage)}
            </span>
            <a
              href={fileUrl(file.id)}
              download={file.name}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-semibold text-accent-fg hover:bg-accent-hover"
            >
              <DownloadSimpleIcon className="size-4" aria-hidden="true" />
              {t('files.download')}
            </a>
          </div>
        )
      }
    >
      {file && (
        <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-md bg-app">
          <img src={fileUrl(file.id)} alt={file.name} className="max-h-[70vh] max-w-full object-contain" />
        </div>
      )}
    </Dialog>
  );
}
