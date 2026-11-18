'use client'

import { Check, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useSWRConfig } from 'swr'
import type { DocumentInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

interface DocumentPanelProps {
  documents: DocumentInfo[]
  isLoading: boolean
  selectedId: number | null
  onSelect: (id: number) => void
  selectedIds?:number[]
  manageOwned?:boolean
  uploadAllowed?:boolean
  cloud?:boolean
  documentsUrl?:string
  onDeleted?:(id:number)=>void
  busy?:boolean
}

export function DocumentPanel({
  documents,
  isLoading,
  selectedId,
  onSelect,
  selectedIds,uploadAllowed=true,manageOwned=uploadAllowed,cloud=false,documentsUrl='/api/documents',onDeleted,busy=false,
}: DocumentPanelProps) {
  const { mutate } = useSWRConfig()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging,setDragging]=useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    if(uploading||busy)return
    if(!uploadAllowed)return
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){setError('Choose a PDF document.');return}
    if(file.size>(cloud?2:15)*1024*1024){setError(`PDF must be at most ${cloud?2:15} MB.`);return}
    setError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Upload failed')
      } else {
        await mutate(documentsUrl)
        onSelect(data.id)
      }
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(id: number) {
    if(!window.confirm('Delete this document, its stored original and its search index? This cannot be undone.'))return
    setError(null)
    try {
      const response=await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if(!response.ok){setError((await response.json()).error ?? 'Deletion failed');return}
      onDeleted?.(id)
      await mutate(documentsUrl)
    } catch {setError('Deletion failed. Check your connection and retry.')}
  }

  return (
    <div className="flex h-full flex-col">
      <div className="p-4">
        <div className="library-title"><h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Library
        </h2><span className="mono-count" aria-label={`${documents.length} documents`}>{documents.length}</span></div>
        {selectedIds&&<p className="mt-3 text-xs">Select up to three documents. {selectedIds.length} selected.</p>}
        {uploadAllowed&&<><p className="mt-3 text-xs">PDF only · {cloud?'2 MB, 3 documents, 2 uploads/day. Short text PDFs only; shared free limits apply.':'15 MB maximum'}</p><button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-busy={uploading}
          disabled={uploading||busy}
          className="mt-4 flex w-full min-h-28 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground hover:border-primary"
          data-dragging={dragging}
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={e=>{e.preventDefault();setDragging(false);const file=e.dataTransfer.files[0];if(file)void handleFile(file)}}
        >
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Chunking &amp; embedding...
            </>
          ) : (
            <>
              <Upload className="size-4" aria-hidden="true" />
              <strong>Upload PDF</strong><span className="drop-hint">Choose a file or drop it here</span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          aria-label="Upload a PDF document"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        </>}
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <ul className="flex-1 overflow-y-auto p-2" aria-label="Document library">
        {isLoading && (
          <li className="px-2 py-3 text-sm text-muted-foreground">
            Loading documents...
          </li>
        )}
        {!isLoading && documents.length === 0 && (
          <li className="px-2 py-3 text-sm text-muted-foreground">
            {uploadAllowed?'No documents yet. Upload a PDF to start.':manageOwned?'Your library is empty.':'Public samples are currently unavailable.'}
          </li>
        )}
        {documents.map((doc) => (
          <li key={doc.id} className="mono-document-row">
            <button
              type="button"
              onClick={() => onSelect(doc.id)}
              disabled={busy}
              aria-pressed={selectedIds?selectedIds.includes(doc.id):selectedId===doc.id}
              className={cn(
                'mono-document',
                (selectedIds?selectedIds.includes(doc.id):selectedId === doc.id)
                  ? 'bg-accent'
                  : 'hover:bg-accent/50',
              )}
            >
              <span className="file-glyph"><FileText
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  (selectedIds?selectedIds.includes(doc.id):selectedId === doc.id)
                    ? 'text-primary'
                    : 'text-muted-foreground',
                )}
                aria-hidden="true"
              />{(selectedIds ? selectedIds.includes(doc.id) : selectedId === doc.id) && <Check size={12} className="file-check" aria-hidden="true"/>}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{doc.title}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {doc.pageCount} {doc.pageCount===1?'page':'pages'} · {doc.chunkCount} {doc.chunkCount===1?'chunk':'chunks'}
                </span>
              </span>
            </button>
            {doc.owned!==false&&manageOwned&&<button
              type="button"
              onClick={() => handleDelete(doc.id)}
              disabled={busy}
              className="mono-document-delete"
              aria-label={`Delete ${doc.title}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>}
          </li>
        ))}
      </ul>
    </div>
  )
}
