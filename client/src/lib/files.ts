import { ApiError } from './api';
import type { FileDto } from './types';

/** Must match the server limit. */
export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_FILES_PER_ITEM = 10;

export type UploadTarget = { chatId: string } | { channelId: string };

export function fileUrl(fileId: string) {
  return `/api/files/${fileId}/content`;
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif', 'image/bmp'];

/** Images shown as previews (the browser renders them in <img>, never as a page). */
export function isImage(mimeType: string) {
  return IMAGE_TYPES.includes(mimeType);
}

export type FileKind = 'image' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'text' | 'video' | 'audio' | 'other';

const EXTENSIONS: Record<string, FileKind> = {
  pdf: 'pdf',
  doc: 'document', docx: 'document', odt: 'document', rtf: 'document', pages: 'document',
  xls: 'spreadsheet', xlsx: 'spreadsheet', ods: 'spreadsheet', csv: 'spreadsheet', numbers: 'spreadsheet',
  ppt: 'presentation', pptx: 'presentation', odp: 'presentation', key: 'presentation',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  txt: 'text', md: 'text', json: 'text', log: 'text',
};

/** Rough kind of a file for its icon, from the MIME type and the extension. */
export function fileKind(mimeType: string, name: string): FileKind {
  if (isImage(mimeType)) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return EXTENSIONS[ext] ?? (mimeType.startsWith('text/') ? 'text' : 'other');
}

/** "820 B", "12,4 KB", "3,1 MB" in the UI language. */
export function formatFileSize(bytes: number, language = 'en') {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

/**
 * Uploads one file with progress. `pending` uploads (from a composer) stay
 * hidden until they are sent with a message, post or reply.
 */
export function uploadFile(
  file: File,
  target: UploadTarget,
  options: { pending: boolean; onProgress?: (fraction: number) => void; signal?: AbortSignal },
): Promise<FileDto> {
  const params = new URLSearchParams({ ...target, ...(options.pending ? { pending: '1' } : {}) });
  const body = new FormData();
  body.append('file', file, file.name);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/files?${params}`);
    xhr.setRequestHeader('X-Client', '1');
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => e.lengthComputable && options.onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status === 201) resolve((xhr.response as { file: FileDto }).file);
      else reject(new ApiError(xhr.status, xhr.response?.code ?? 'generic', xhr.response?.message ?? xhr.statusText));
    };
    xhr.onerror = () => reject(new ApiError(0, 'network', 'Network error'));
    xhr.onabort = () => reject(new ApiError(0, 'aborted', 'Upload cancelled'));
    options.signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(body);
  });
}
