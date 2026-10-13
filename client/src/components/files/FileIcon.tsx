import clsx from 'clsx';
import {
  FileArchiveIcon,
  FileAudioIcon,
  FileDocIcon,
  FileIcon as GenericFileIcon,
  FileImageIcon,
  FilePdfIcon,
  FilePptIcon,
  FileTextIcon,
  FileVideoIcon,
  FileXlsIcon,
} from '@phosphor-icons/react';
import { fileKind, type FileKind } from '@/lib/files';

const ICONS: Record<FileKind, { icon: typeof GenericFileIcon; color: string }> = {
  image: { icon: FileImageIcon, color: 'text-[#8764B8]' },
  pdf: { icon: FilePdfIcon, color: 'text-[#C4314B]' },
  document: { icon: FileDocIcon, color: 'text-[#2B7CD3]' },
  spreadsheet: { icon: FileXlsIcon, color: 'text-[#0F7B6C]' },
  presentation: { icon: FilePptIcon, color: 'text-[#B35C00]' },
  archive: { icon: FileArchiveIcon, color: 'text-muted' },
  text: { icon: FileTextIcon, color: 'text-muted' },
  video: { icon: FileVideoIcon, color: 'text-[#A0459B]' },
  audio: { icon: FileAudioIcon, color: 'text-[#498205]' },
  other: { icon: GenericFileIcon, color: 'text-muted' },
};

/** Coloured document icon matching the file type. */
export function FileIcon({ mimeType, name, className }: { mimeType: string; name: string; className?: string }) {
  const { icon: Icon, color } = ICONS[fileKind(mimeType, name)];
  return <Icon className={clsx('shrink-0', color, className ?? 'size-6')} weight="duotone" aria-hidden="true" />;
}
