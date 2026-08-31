'use client';

import { useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import { Camera, Upload } from 'lucide-react';
import { uploadDocumentsAction } from '@/app/(app)/matters/[id]/documents-actions';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { DOCUMENT_CATEGORY_LABELS, entries } from '@/lib/labels';
import {
  DOCUMENT_ACCEPT_ATTRIBUTE, formatBytes, validateDocumentFile,
} from '@/lib/uploads';

/**
 * Drag-and-drop or tap-to-choose upload, plus a camera button that opens
 * the phone's rear camera directly — advocates photograph a stamped copy
 * at the registry and file it before they leave the building.
 */
export function DocumentUpload({ matterId }: { matterId: string }) {
  const [state, action] = useFormState(uploadDocumentsAction, EMPTY_FORM_STATE);
  const [files, setFiles] = useState<File[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const accept = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const next = Array.from(incoming);
    for (const file of next) {
      const problem = validateDocumentFile(file);
      if (problem) {
        setLocalError(problem);
        return;
      }
    }
    setLocalError(null);
    setFiles((current) => [...current, ...next]);
  };

  // The chosen files live in React state, not in the file inputs, so the
  // list survives adding more from the camera. Rebuild a DataTransfer on
  // submit so the action receives them all under one field name.
  const onSubmit = () => {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    if (inputRef.current) inputRef.current.files = transfer.files;
    if (cameraRef.current) cameraRef.current.value = '';
  };

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={onSubmit}
      className="space-y-4 border-b border-ink-200 p-4"
    >
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {localError ? <Alert tone="error">{localError}</Alert> : null}

      <input type="hidden" name="matter_id" value={matterId} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
          dragging ? 'border-brand-500 bg-brand-50' : 'border-ink-300 bg-ink-50'
        }`}
      >
        <Upload className="mx-auto h-6 w-6 text-ink-400" />
        <p className="mt-2 text-sm text-ink-700">
          Drag files here, or{' '}
          <button type="button" className="font-medium text-brand-700 underline"
                  onClick={() => inputRef.current?.click()}>
            choose from this device
          </button>
        </p>
        <p className="mt-1 text-xs text-ink-500">
          PDF, Word, JPG or PNG. Up to 25 MB per file.
        </p>

        <button type="button" className="btn-secondary mt-3"
                onClick={() => cameraRef.current?.click()}>
          <Camera className="h-4 w-4" /> Take a photo
        </button>

        <input ref={inputRef} type="file" name="files" multiple className="hidden"
               accept={DOCUMENT_ACCEPT_ATTRIBUTE}
               onChange={(e) => {
                 accept(e.target.files);
                 e.target.value = '';
               }} />
        <input ref={cameraRef} type="file" className="hidden" accept="image/*" capture="environment"
               onChange={(e) => {
                 accept(e.target.files);
                 e.target.value = '';
               }} />
      </div>

      {files.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded border border-ink-200 bg-white px-3 py-2">
              <span className="min-w-0 truncate">{file.name}</span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-ink-500">
                {formatBytes(file.size)}
                <button type="button" className="text-red-700 hover:underline"
                        onClick={() => setFiles((c) => c.filter((_, i) => i !== index))}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="upload_category">Category</label>
          <select id="upload_category" name="category" className="input" defaultValue="pleading">
            {entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="upload_notes">Note (optional)</label>
          <input id="upload_notes" name="notes" className="input"
                 placeholder="Filed at Milimani, stamped 14/03/2026" />
        </div>
      </div>

      <SubmitButton pendingText="Uploading…">
        Upload {files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'}` : ''}
      </SubmitButton>
    </form>
  );
}
