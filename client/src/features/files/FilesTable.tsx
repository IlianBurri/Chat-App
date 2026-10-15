import { ChatCircleTextIcon, DotsThreeIcon, DownloadSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { FileIcon } from '@/components/files/FileIcon';
import { ImageViewer } from '@/components/files/ImageViewer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toaster';
import { api } from '@/lib/api';
import { fileUrl, formatFileSize, isImage } from '@/lib/files';
import { formatListTimestamp } from '@/lib/format';
import { channelPath, chatPath } from '@/lib/links';
import type { FileDto } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { chatTitle, useChatsStore } from '@/stores/chats';
import { useWorkspacesStore } from '@/stores/workspaces';

/** Where a file was shared: chat name or "Workgroup › Channel". */
function useLocationLabel() {
  const { t } = useTranslation();
  const meId = useAuthStore((s) => s.user?.id);
  const chats = useChatsStore((s) => s.chats);
  const workspaces = useWorkspacesStore((s) => s.workspaces);
  return (file: FileDto) => {
    if (file.chatId) {
      const chat = chats.find((c) => c.id === file.chatId);
      return chat ? chatTitle(chat, meId) : t('activity.chat');
    }
    const workspace = workspaces.find((w) => w.id === file.workspaceId);
    const channel = workspace?.channels.find((c) => c.id === file.channelId);
    if (!workspace || !channel) return t('activity.channel');
    return `${workspace.name} › ${channel.isDefault ? t('teams.general') : channel.name}`;
  };
}

/** The conversation a file was shared in, scrolled to its message or post. */
export function fileContextPath(file: FileDto) {
  if (file.chatId) return chatPath(file.chatId, file.messageId);
  if (file.workspaceId && file.channelId) return channelPath(file.workspaceId, file.channelId, file.postId, file.replyId);
  return null;
}

interface FilesTableProps {
  files: FileDto[];
  /** Adds the "Location" column (Files app) */
  showLocation?: boolean;
  /** Owners of the workgroup may delete other people's channel files */
  canModerate?: (file: FileDto) => boolean;
  label: string;
}

export function FilesTable({ files, showLocation = false, canModerate, label }: FilesTableProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToast((s) => s.show);
  const meId = useAuthStore((s) => s.user?.id);
  const locationOf = useLocationLabel();
  const [viewing, setViewing] = useState<FileDto | null>(null);
  const [deleting, setDeleting] = useState<FileDto | null>(null);
  const now = new Date();

  return (
    <>
      <table aria-label={label} className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="py-2 pr-3 pl-5 font-medium">{t('files.columns.name')}</th>
            {showLocation && <th scope="col" className="hidden w-[24%] px-3 py-2 font-medium lg:table-cell">{t('files.columns.location')}</th>}
            <th scope="col" className="hidden w-[18%] px-3 py-2 font-medium md:table-cell">{t('files.columns.sharedBy')}</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">{t('files.columns.date')}</th>
            <th scope="col" className="hidden w-24 px-3 py-2 text-right font-medium sm:table-cell">{t('files.columns.size')}</th>
            <th scope="col" className="w-14 py-2 pr-5"><span className="sr-only">{t('files.columns.actions')}</span></th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const context = fileContextPath(file);
            const deletable = file.uploader.id === meId || (canModerate?.(file) ?? false);
            return (
              <tr key={file.id} className="group border-b border-line hover:bg-hover">
                <td className="py-2 pr-3 pl-5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <FileIcon mimeType={file.mimeType} name={file.name} />
                    {isImage(file.mimeType) ? (
                      <button type="button" onClick={() => setViewing(file)} className="truncate text-left font-medium hover:underline">
                        {file.name}
                      </button>
                    ) : (
                      <a href={fileUrl(file.id)} download={file.name} className="truncate font-medium hover:underline">
                        {file.name}
                      </a>
                    )}
                  </span>
                </td>
                {showLocation && <td className="hidden truncate px-3 py-2 text-muted lg:table-cell">{locationOf(file)}</td>}
                <td className="hidden truncate px-3 py-2 text-muted md:table-cell">{file.uploader.id === meId ? t('common.you') : file.uploader.name}</td>
                <td className="px-3 py-2 text-muted">
                  <time dateTime={file.createdAt}>
                    {formatListTimestamp(new Date(file.createdAt), now, i18n.resolvedLanguage, { yesterday: t('chat.yesterday') })}
                  </time>
                </td>
                <td className="hidden px-3 py-2 text-right text-muted tabular-nums sm:table-cell">{formatFileSize(file.size, i18n.resolvedLanguage)}</td>
                <td className="py-1 pr-5 text-right">
                  <Menu
                    label={t('files.actionsFor', { name: file.name })}
                    width={240}
                    trigger={({ ref, ...props }) => <IconButton ref={ref} label={t('files.actionsFor', { name: file.name })} icon={DotsThreeIcon} size="sm" {...props} />}
                  >
                    <MenuItem icon={DownloadSimpleIcon} onSelect={() => window.location.assign(fileUrl(file.id))}>
                      {t('files.download')}
                    </MenuItem>
                    {context && (file.messageId || file.postId) && (
                      <MenuItem icon={ChatCircleTextIcon} onSelect={() => navigate(context)}>
                        {t('files.showInConversation')}
                      </MenuItem>
                    )}
                    {deletable && (
                      <>
                        <MenuSeparator />
                        <MenuItem icon={TrashIcon} danger onSelect={() => setDeleting(file)}>
                          {t('message.delete')}
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ImageViewer file={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title={t('files.deleteTitle')}
        confirmLabel={t('message.delete')}
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.delete(`/files/${deleting.id}`);
          } catch {
            showToast(t('auth.errors.generic'), 'error');
          }
        }}
      >
        {t('files.deleteText', { name: deleting?.name ?? '' })}
      </ConfirmDialog>
    </>
  );
}
