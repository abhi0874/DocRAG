/** Small, bounded optical-shape model. Visual inspiration, not a fluid simulation. */
export interface LiquidTarget { center: number; width: number }
export interface LiquidState extends LiquidTarget {
  velocity: number
  widthVelocity: number
  stretch: number
}

export const liquidAt = (target: LiquidTarget): LiquidState => ({
  ...target, velocity: 0, widthVelocity: 0, stretch: 0,
})

/** Exact underdamped spring solution; dt is seconds, independent of display Hz. */
function spring(position: number, velocity: number, target: number, dt: number) {
  const frequency = 22, damping = 0.86
  const decay = damping * frequency
  const oscillation = frequency * Math.sqrt(1 - damping * damping)
  const offset = position - target
  const coefficient = (velocity + decay * offset) / oscillation
  const envelope = Math.exp(-decay * dt)
  const cos = Math.cos(oscillation * dt), sin = Math.sin(oscillation * dt)
  return {
    position: target + envelope * (offset * cos + coefficient * sin),
    velocity: envelope * ((coefficient * oscillation - decay * offset) * cos
      - (offset * oscillation + decay * coefficient) * sin),
  }
}

export function advanceLiquid(state: LiquidState, target: LiquidTarget, elapsed: number): LiquidState {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return state
  // A background-tab gap should settle, never integrate a huge impulse.
  if (elapsed > 0.25) return liquidAt(target)
  const center = spring(state.center, state.velocity, target.center, elapsed)
  const width = spring(state.width, state.widthVelocity, target.width, elapsed)
  const desiredStretch = Math.min(26, Math.abs(center.velocity) * 0.016)
  const stretch = state.stretch + (desiredStretch - state.stretch) * (1 - Math.exp(-30 * elapsed))
  return {center: center.position, velocity: center.velocity,
    width: Math.max(1, width.position), widthVelocity: width.velocity, stretch}
}

export function liquidSettled(state: LiquidState, target: LiquidTarget) {
  return Math.abs(state.center - target.center) < 0.035
    && Math.abs(state.width - target.width) < 0.035
    && Math.abs(state.velocity) < 0.2
    && Math.abs(state.widthVelocity) < 0.2 && state.stretch < 0.045
}

/** One closed contour: rounded ends, a restrained neck, and velocity-led extension. */
export function liquidPath(state: LiquidState, height: number, containerWidth: number): string {
  if (height < 1 || containerWidth < 1) return ''
  const inset = 4, top = inset, bottom = Math.max(inset + 1, height - inset)
  const midY = (top + bottom) / 2, radius = (bottom - top) / 2
  const direction = Math.sign(state.velocity)
  const half = Math.max(radius, state.width / 2 - inset)
  const left = Math.max(inset, state.center - half - state.stretch * (direction < 0 ? 0.72 : 0.28))
  const right = Math.min(containerWidth - inset, state.center + half + state.stretch * (direction > 0 ? 0.72 : 0.28))
  if (right <= left) return ''
  const r = Math.min(radius, (right - left) / 2)
  const a = left + r, b = right - r, center = (a + b) / 2
  const neck = Math.min(radius * 0.23, state.stretch * 0.20)
  const handle = Math.max(0, (b - a) * 0.22)
  const n = (value: number) => Math.round(value * 1000) / 1000
  return `M ${n(left)} ${n(midY)} C ${n(left)} ${n(top + r * 0.45)} ${n(left + r * 0.45)} ${n(top)} ${n(a)} ${n(top)} C ${n(a + handle)} ${n(top)} ${n(center - handle)} ${n(top + neck)} ${n(center)} ${n(top + neck)} C ${n(center + handle)} ${n(top + neck)} ${n(b - handle)} ${n(top)} ${n(b)} ${n(top)} C ${n(right - r * 0.45)} ${n(top)} ${n(right)} ${n(top + r * 0.45)} ${n(right)} ${n(midY)} C ${n(right)} ${n(bottom - r * 0.45)} ${n(right - r * 0.45)} ${n(bottom)} ${n(b)} ${n(bottom)} C ${n(b - handle)} ${n(bottom)} ${n(center + handle)} ${n(bottom - neck)} ${n(center)} ${n(bottom - neck)} C ${n(center - handle)} ${n(bottom - neck)} ${n(a + handle)} ${n(bottom)} ${n(a)} ${n(bottom)} C ${n(left + r * 0.45)} ${n(bottom)} ${n(left)} ${n(bottom - r * 0.45)} ${n(left)} ${n(midY)} Z`
}

export function nextLiquidOption(options: readonly {disabled?: boolean}[], current: number, key: string): number {
  const available = options.flatMap((option, index) => option.disabled ? [] : [index])
  if (!available.length) return -1
  if (key === 'Home') return available[0]
  if (key === 'End') return available[available.length - 1]
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0
  if (!step) return current
  const at = available.indexOf(current)
  return available[(at + step + available.length) % available.length]
}
