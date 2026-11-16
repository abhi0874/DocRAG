'use client'

import {useEffect, useId, useRef, type KeyboardEvent} from 'react'
import {advanceLiquid, liquidAt, liquidPath, liquidSettled, nextLiquidOption, type LiquidState, type LiquidTarget} from '@/lib/ui/liquid-physics'
import {cn} from '@/lib/utils'
import './liquid-pill.css'

export interface LiquidPillOption { value: string; label: string; disabled?: boolean }
export interface LiquidPillGroupProps {
  options: readonly LiquidPillOption[]
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
  disabled?: boolean
}

export function LiquidPillGroup({options, value, onChange, label, className, disabled = false}: LiquidPillGroupProps) {
  const root = useRef<HTMLDivElement>(null)
  const lens = useRef<SVGPathElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const state = useRef<LiquidState | null>(null)
  const selected = useRef(value)
  const retarget = useRef<(() => void) | null>(null)
  const id = useId().replaceAll(':', '')
  const effective = options.find(option => option.value === value && !option.disabled)?.value
    ?? options.find(option => !option.disabled)?.value
  const optionSignature = JSON.stringify(options)

  useEffect(() => {
    selected.current = effective ?? ''
    retarget.current?.()
  }, [effective])

  useEffect(() => {
    const group = root.current, path = lens.current, canvas = svg.current
    if (!group || !path || !canvas) return
    let frame = 0, previous = 0, disposed = false
    let targets = new Map<string, LiquidTarget>()
    let target: LiquidTarget | undefined
    let width = 0, height = 0
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button[data-liquid-value]'))
    const paint = () => {
      if (state.current) path.setAttribute('d', liquidPath(state.current, height, width))
    }
    const tick = (now: number) => {
      frame = 0
      if (disposed || !target || !state.current) return
      const elapsed = previous ? (now - previous) / 1000 : 0
      previous = now
      state.current = advanceLiquid(state.current, target, elapsed)
      if (liquidSettled(state.current, target)) {
        state.current = liquidAt(target)
        previous = 0
        group.dataset.animating = 'false'
        paint()
      } else {
        paint()
        frame = requestAnimationFrame(tick)
      }
    }
    const aim = () => {
      target = targets.get(selected.current)
      if (!target) {
        cancelAnimationFrame(frame); frame = 0; path.setAttribute('d', '')
        return
      }
      if (!state.current || motion.matches || document.documentElement.dataset.motion === 'reduce' || document.hidden) {
        cancelAnimationFrame(frame); frame = 0; previous = 0
        state.current = liquidAt(target)
        group.dataset.animating = 'false'
        paint()
      } else if (!frame) {
        previous = 0
        group.dataset.animating = 'true'
        frame = requestAnimationFrame(tick)
      }
    }
    const measure = () => {
      // All geometry reads happen together on mount/resize/font changes, never per frame.
      width = group.scrollWidth; height = group.clientHeight
      targets = new Map(buttons.map(button => [button.dataset.liquidValue!, {
        center: button.offsetLeft + button.offsetWidth / 2, width: button.offsetWidth,
      }]))
      canvas.setAttribute('width', String(width))
      canvas.setAttribute('height', String(height))
      canvas.setAttribute('viewBox', `0 0 ${width} ${height}`)
      group.dataset.measured = 'true'
      aim()
    }
    const preferenceObserver = new MutationObserver(aim)
    preferenceObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['data-motion']})
    retarget.current = aim
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(group)
    for (const button of buttons) observer?.observe(button)
    window.addEventListener('resize', measure)
    motion.addEventListener('change', aim)
    document.addEventListener('visibilitychange', aim)
    void document.fonts?.ready.then(() => {if (!disposed) measure()})
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer?.disconnect()
      preferenceObserver.disconnect()
      window.removeEventListener('resize', measure)
      motion.removeEventListener('change', aim)
      document.removeEventListener('visibilitychange', aim)
      retarget.current = null
    }
  }, [optionSignature])

  function keyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || disabled) return
    event.preventDefault()
    const next = nextLiquidOption(options, index, event.key)
    if (next < 0) return
    onChange(options[next].value)
    root.current?.querySelectorAll<HTMLButtonElement>('button[data-liquid-value]')[next]?.focus()
  }

  return <div ref={root} className={cn('liquid-pill-group', className)} role="radiogroup" aria-label={label} aria-disabled={disabled || undefined}>
    <svg ref={svg} className="liquid-pill-lens" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <linearGradient id={`${id}-material`} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0" stopColor="var(--liquid-shine)" />
          <stop offset="0.46" stopColor="var(--liquid-body)" />
          <stop offset="1" stopColor="var(--liquid-floor)" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="var(--liquid-edge)" />
          <stop offset="0.45" stopColor="var(--liquid-edge-dim)" />
          <stop offset="1" stopColor="var(--liquid-edge)" />
        </linearGradient>
      </defs>
      <path ref={lens} data-liquid-indicator="" fill={`url(#${id}-material)`} stroke={`url(#${id}-edge)`} strokeWidth="1" />
    </svg>
    {options.map((option, index) => <button key={option.value} type="button" role="radio"
      aria-checked={effective === option.value} disabled={disabled || option.disabled}
      tabIndex={!disabled && effective === option.value ? 0 : -1}
      data-liquid-value={option.value} className="liquid-pill-option"
      onKeyDown={event => keyboard(event, index)} onClick={() => onChange(option.value)}>
      {option.label}
    </button>)}
  </div>
}
