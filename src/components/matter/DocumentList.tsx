'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Download, Eye, Pencil, Trash2, X } from 'lucide-react';
import {
  deleteDocumentAction, updateDocumentAction,
} from '@/app/(app)/matters/[id]/documents-actions';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { DOCUMENT_CATEGORY_LABELS, entries } from '@/lib/labels';
import { formatDateTime } from '@/lib/dates';
import { formatBytes } from '@/lib/uploads';
import type { DocumentCategory } from '@/lib/types';

export interface DocumentRow {
  id: string;
  file_name: string;
  category: DocumentCategory;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  notes: string | null;
  uploader: { full_name: string } | null;
}

function isPreviewable(mime: string | null): boolean {
  return mime === 'application/pdf' || mime === 'image/png' || mime === 'image/jpeg';
}

export function DocumentList({
  documents,
  matterId,
  canEdit,
  canDelete,
}: {
  documents: DocumentRow[];
  matterId: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<DocumentRow | null>(null);

  if (documents.length === 0) {
    return (
      <EmptyState
        title="No documents on this file yet"
        description="Pleadings, correspondence, court orders and attendance notes all live here."
      />
    );
  }

  return (
    <>
      <ul className="divide-y divide-ink-200">
        {documents.map((document) => (
          <li key={document.id} className="px-4 py-3">
            {editing === document.id ? (
              <EditDocumentForm
                document={document}
                matterId={matterId}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-medium text-ink-900">{document.file_name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <Badge>{DOCUMENT_CATEGORY_LABELS[document.category]}</Badge>
                    <span>{formatBytes(document.size_bytes)}</span>
                    <span>
                      {formatDateTime(document.uploaded_at)}
                      {document.uploader ? ` · ${document.uploader.full_name}` : ''}
                    </span>
                  </p>
                  {document.notes ? (
                    <p className="mt-1 text-sm text-ink-600">{document.notes}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {isPreviewable(document.mime_type) ? (
                    <button type="button" className="btn-secondary"
                            onClick={() => setPreviewing(document)}>
                      <Eye className="h-4 w-4" /> Preview
                    </button>
                  ) : null}
                  <a className="btn-secondary" href={`/api/documents/${document.id}?download=1`}>
                    <Download className="h-4 w-4" /> Download
                  </a>
                  {canEdit ? (
                    <button type="button" className="btn-secondary"
                            onClick={() => setEditing(document.id)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Rename or re-categorise</span>
                    </button>
                  ) : null}
                  {canDelete ? (
                    <form action={deleteDocumentAction}>
                      <input type="hidden" name="document_id" value={document.id} />
                      <input type="hidden" name="matter_id" value={matterId} />
                      <input type="hidden" name="file_name" value={document.file_name} />
                      <button type="submit" className="btn-danger">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {previewing ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink-900/80 p-2 sm:p-6"
             role="dialog" aria-label={`Preview of ${previewing.file_name}`}>
          <div className="mb-2 flex items-center justify-between gap-3 text-white">
            <p className="truncate text-sm">{previewing.file_name}</p>
            <button type="button" className="rounded p-2 hover:bg-white/10"
                    onClick={() => setPreviewing(null)} aria-label="Close preview">
              <X className="h-5 w-5" />
            </button>
          </div>
          {previewing.mime_type === 'application/pdf' ? (
            <iframe
              title={previewing.file_name}
              src={`/api/documents/${previewing.id}`}
              className="min-h-0 flex-1 rounded bg-white"
            />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded bg-white p-2">
              <img src={`/api/documents/${previewing.id}`} alt={previewing.file_name}
                   className="max-h-full w-auto object-contain" />
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

function EditDocumentForm({
  document,
  matterId,
  onDone,
}: {
  document: DocumentRow;
  matterId: string;
  onDone: () => void;
}) {
  const [state, action] = useFormState(updateDocumentAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="space-y-3">
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <input type="hidden" name="document_id" value={document.id} />
      <input type="hidden" name="matter_id" value={matterId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`name-${document.id}`}>File name</label>
          <input id={`name-${document.id}`} name="file_name" className="input"
                 defaultValue={document.file_name} required />
        </div>
        <div>
          <label className="label" htmlFor={`cat-${document.id}`}>Category</label>
          <select id={`cat-${document.id}`} name="category" className="input"
                  defaultValue={document.category}>
            {entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`notes-${document.id}`}>Note</label>
        <input id={`notes-${document.id}`} name="notes" className="input"
               defaultValue={document.notes ?? ''} />
      </div>
      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
        <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}
