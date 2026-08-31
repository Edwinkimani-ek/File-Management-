'use client';

import { useRef, useState, useTransition } from 'react';
import { Camera, Upload } from 'lucide-react';
import { uploadDocumentsAction } from '@/app/(app)/matters/[id]/documents-actions';
import { Alert } from '@/components/ui/Alert';
import { EMPTY_FORM_STATE, type FormState } from '@/lib/forms';
import { DOCUMENT_CATEGORY_LABELS, entries } from '@/lib/labels';
import {
  DOCUMENT_ACCEPT_ATTRIBUTE, formatBytes, validateDocumentFile,
} from '@/lib/uploads';

/**
 * Drag-and-drop or tap-to-choose upload, plus a camera button that opens
 * the phone's rear camera directly — advocates photograph a stamped copy
 * at the registry and file it before they leave the building.
 *
 * The chosen files live in React state rather than in a file input, so
 * that a photo can be added to a set already picked from the device. That
 * means the FormData is assembled here and the action called directly,
 * instead of letting the browser serialise a form whose file input we
 * would have had to rewrite on the way past.
 */
export function DocumentUpload({ matterId }: { matterId: string }) {
  const [state, setState] = useState<FormState>(EMPTY_FORM_STATE);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);

  const accept = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const next = Array.from(incoming);
    for (const file of next) {
      const problem = validateDocumentFile(file);
      if (problem) {
        setState({ error: problem });
        return;
      }
    }
    setState(EMPTY_FORM_STATE);
    setFiles((current) => [...current, ...next]);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (files.length === 0) {
      setState({ error: 'Choose at least one file to upload.' });
      return;
    }

    const data = new FormData();
    data.set('matter_id', matterId);
    data.set('category', categoryRef.current?.value ?? 'other');
    data.set('notes', notesRef.current?.value ?? '');
    for (const file of files) data.append('files', file);

    startTransition(async () => {
      const result = await uploadDocumentsAction(EMPTY_FORM_STATE, data);
      setState(result);
      if (!result.error) {
        setFiles([]);
        if (notesRef.current) notesRef.current.value = '';
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 border-b border-ink-200 p-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

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

        <input ref={inputRef} type="file" multiple className="hidden"
               accept={DOCUMENT_ACCEPT_ATTRIBUTE}
               onChange={(e) => {
                 accept(e.target.files);
                 e.target.value = '';
               }} />
        <input ref={cameraRef} type="file" className="hidden" accept="image/*"
               capture="environment"
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
          <select ref={categoryRef} id="upload_category" className="input" defaultValue="pleading">
            {entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="upload_notes">Note (optional)</label>
          <input ref={notesRef} id="upload_notes" className="input"
                 placeholder="Filed at Milimani, stamped 14/03/2026" />
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={pending || files.length === 0}>
        {pending
          ? 'Uploading…'
          : `Upload${files.length > 0 ? ` ${files.length} file${files.length === 1 ? '' : 's'}` : ''}`}
      </button>
    </form>
  );
}
