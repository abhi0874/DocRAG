'use client'

import { FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useSWRConfig } from 'swr'
import type { DocumentInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

interface DocumentPanelProps {
  documents: DocumentInfo[]
  isLoading: boolean
  selectedId: number | null
  onSelect: (id: number) => void
}

export function DocumentPanel({
  documents,
  isLoading,
  selectedId,
  onSelect,
}: DocumentPanelProps) {
  const { mutate } = useSWRConfig()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging,setDragging]=useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    if(uploading)return
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){setError('Choose a PDF document.');return}
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
        await mutate('/api/documents')
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
    setError(null)
    try {
      const response=await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if(!response.ok){setError((await response.json()).error ?? 'Deletion failed');return}
      await mutate('/api/documents')
    } catch {setError('Deletion failed. Check your connection and retry.')}
  }

  return (
    <div className="flex h-full flex-col">
      <div className="p-4">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Documents
        </h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
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
              Upload PDF
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
            No documents yet. Upload a PDF to start.
          </li>
        )}
        {documents.map((doc) => (
          <li key={doc.id} className="mono-document-row">
            <button
              type="button"
              onClick={() => onSelect(doc.id)}
              aria-pressed={selectedId===doc.id}
              className={cn(
                'mono-document',
                selectedId === doc.id
                  ? 'bg-accent'
                  : 'hover:bg-accent/50',
              )}
            >
              <FileText
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  selectedId === doc.id
                    ? 'text-primary'
                    : 'text-muted-foreground',
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{doc.title}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {doc.pageCount} pages / {doc.chunkCount} chunks
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleDelete(doc.id)}
              className="mono-document-delete"
              aria-label={`Delete ${doc.title}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
