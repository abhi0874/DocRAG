'use client'

import { useEffect, useRef } from 'react'
import type { SourceChunk } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SourcesPanelProps {
  sources: SourceChunk[]
  activeIndex: number | null
  focusKey?: number
}

function ScoreBar({
  label,
  value,
  max,
}: {
  label: string
  value: number | null
  max: number
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={`${label} score`}
        aria-valuenow={Math.max(0, Math.min(max, value ?? 0))}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
        {value === null ? '—' : value.toFixed(3)}
      </span>
    </div>
  )
}

export function SourcesPanel({ sources, activeIndex, focusKey = 0 }: SourcesPanelProps) {
  const itemRefs = useRef<(HTMLLIElement | null)[]>([])
  const activeSourceId = activeIndex === null ? null : sources[activeIndex]?.id ?? null

  useEffect(() => {
    if (activeSourceId !== null && activeIndex !== null && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.focus({preventScroll:true})
      itemRefs.current[activeIndex]?.scrollIntoView({
        behavior: (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce') ? 'instant' : 'smooth',
        block: 'nearest',
      })
    }
  }, [activeIndex, activeSourceId, focusKey])

  return (
    <div className="flex h-full flex-col">
      <div className="mono-panel-heading">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          The evidence
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Follow a citation. See it in context.
        </p>
      </div>
      <ol className="mono-sources-list" aria-label="Retrieved source chunks">
        {sources.length === 0 && (
          <li className="px-2 py-3 text-sm text-muted-foreground">
            Every answer has a starting point. Ask a question, then open a citation to explore the original passage.
          </li>
        )}
        {sources.map((source, i) => (
          <li
            key={source.id}
            tabIndex={-1}
            data-active={activeIndex===i}
            ref={(el) => {
              itemRefs.current[i] = el
            }}
            className={cn(
              'mono-source',
              activeIndex === i
                ? 'border-primary/60 bg-primary/5'
                : 'border-border bg-card',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded bg-primary/15 font-mono text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  page {source.pageNumber} / chunk #{source.chunkIndex}
                </span>
              </span>
            </div>
            <p className="mono-source-passage">
              {source.content}
            </p>
            <details><summary>Retrieval details</summary><div className="mt-3 flex flex-col gap-1.5">
              <ScoreBar label="vector" value={source.vectorScore} max={1} />
              <ScoreBar label="keyword" value={source.keywordScore} max={0.2} />
              <ScoreBar label="rrf" value={source.rrfScore} max={0.035} />
            </div></details>
          </li>
        ))}
      </ol>
    </div>
  )
}
