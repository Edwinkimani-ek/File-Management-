export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg',
  'image/png',
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png'];

export const DOCUMENT_ACCEPT_ATTRIBUTE =
  '.pdf,.docx,.doc,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extensionOf(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * Checks a file before it goes anywhere near storage. The bucket enforces
 * the same size limit and MIME allow-list, so a caller that skips this
 * still cannot smuggle an executable in.
 */
export function validateDocumentFile(file: {
  name: string;
  size: number;
  type: string;
}): string | null {
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name} is ${formatBytes(file.size)}. The limit is 25 MB per file — split it or compress it and try again.`;
  }
  const extension = extensionOf(file.name);
  const typeOk = (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type);
  const extensionOk = ALLOWED_DOCUMENT_EXTENSIONS.includes(extension);
  if (!typeOk || !extensionOk) {
    return `${file.name} is not an accepted file type. Upload a PDF, Word document, JPG or PNG.`;
  }
  return null;
}

/** Strips anything that would be awkward or unsafe inside a storage key. */
export function safeFileName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(-120) || 'file';
}
