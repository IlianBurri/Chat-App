import { FolderIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DropOverlay } from '@/components/files/AttachmentTray';
import { EmptyState } from '@/components/layout/PlaceholderView';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { ApiError } from '@/lib/api';
import { MAX_FILE_SIZE, uploadFile, type UploadTarget } from '@/lib/files';
import type { FileDto } from '@/lib/types';
import { FilesTable } from './FilesTable';
import { useFileList } from './useFileList';

interface FilesTabProps {
  target: UploadTarget;
  label: string;
  canModerate?: (file: FileDto) => boolean;
}

/** "Files" tab of a chat or channel: everything shared there, plus direct uploads. */
export function FilesTab({ target, label, canModerate }: FilesTabProps) {
  const { t } = useTranslation();
  const showToast = useToast((s) => s.show);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const scope = 'chatId' in target ? { chatId: target.chatId } : { channelId: target.channelId };
  const query = 'chatId' in target ? `chatId=${target.chatId}` : `channelId=${target.channelId}`;
  const { files, loaded, error, reload } = useFileList(query, scope);

  const upload = async (list: FileList) => {
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_SIZE) {
        showToast(t('files.tooLarge', { name: file.name }), 'error');
        continue;
      }
      setUploading({ name: file.name, progress: 0 });
      try {
        await uploadFile(file, target, { pending: false, onProgress: (progress) => setUploading({ name: file.name, progress }) });
        showToast(t('files.uploaded', { name: file.name }));
      } catch (err) {
        showToast(err instanceof ApiError && err.status === 413 ? t('files.tooLarge', { name: file.name }) : t('files.uploadFailed', { name: file.name }), 'error');
      }
    }
    setUploading(null);
  };

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setDragging(false)}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(false);
        void upload(e.dataTransfer.files);
      }}
    >
      <DropOverlay visible={dragging} />
      <div className="flex items-center gap-3 px-5 py-3">
        <Button variant="primary" size="sm" icon={UploadSimpleIcon} disabled={uploading !== null} onClick={() => inputRef.current?.click()}>
          {t('files.upload')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = '';
          }}
        />
        {uploading && (
          <span role="status" className="text-xs text-muted">
            {t('files.uploadingName', { name: uploading.name, percent: Math.round(uploading.progress * 100) })}
          </span>
        )}
        {loaded && !error && <span className="ml-auto text-xs text-muted">{t('files.count', { count: files.length })}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!loaded ? (
          <p className="px-5 py-4 text-sm text-muted">{t('common.loading')}</p>
        ) : error ? (
          <div className="px-5 py-4 text-sm">
            <p className="mb-2 text-muted">{t('auth.errors.generic')}</p>
            <Button size="sm" onClick={reload}>
              {t('common.retry')}
            </Button>
          </div>
        ) : files.length === 0 ? (
          <EmptyState icon={FolderIcon} title={t('files.emptyTitle')} text={t('files.emptyTab')} />
        ) : (
          <FilesTable files={files} label={label} canModerate={canModerate} />
        )}
      </div>
    </div>
  );
}
