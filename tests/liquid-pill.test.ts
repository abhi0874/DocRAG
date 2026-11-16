import {describe, expect, it} from 'vitest'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {advanceLiquid, liquidAt, liquidPath, liquidSettled, nextLiquidOption} from '../lib/ui/liquid-physics'
import {LiquidPillGroup} from '../components/ui/liquid-pill-group'

const simulate = (hz: number, center = 300, width = 160) => {
  let state = liquidAt({center: 50, width: 80})
  const target = {center, width}
  for (let i = 0; i < hz * 2; i++) state = advanceLiquid(state, target, 1 / hz)
  return {state, target}
}
describe('liquid spring and contour', () => {
  it.each([60, 90, 120, 144, 165])('settles to the correct variable-width target at %i Hz', hz => {
    const {state, target} = simulate(hz)
    expect(liquidSettled(state, target)).toBe(true)
    expect(state.center).toBeCloseTo(300, 5)
    expect(state.width).toBeCloseTo(160, 5)
  })
  it('has matching intermediate spring positions across refresh rates', () => {
    const step = (hz: number) => {
      let state = liquidAt({center: 50, width: 80})
      for (let i = 0; i < hz / 5; i++) state = advanceLiquid(state, {center: 300, width: 160}, 1 / hz)
      return state
    }
    expect(step(60).center).toBeCloseTo(step(165).center, 6)
    expect(step(60).width).toBeCloseTo(step(165).width, 6)
  })
  it('supports non-adjacent travel, rapid selection and a reversal without stranded motion', () => {
    let state = liquidAt({center: 45, width: 80})
    for (const center of [135, 420, 45, 320, 135, 45]) {
      for (let i = 0; i < 4; i++) state = advanceLiquid(state, {center, width: center === 45 ? 80 : 130}, 1 / 165)
    }
    const target = {center: 45, width: 80}
    for (let i = 0; i < 330; i++) state = advanceLiquid(state, target, 1 / 165)
    expect(liquidSettled(state, target)).toBe(true)
  })
  it('retargets during resizing and label width changes', () => {
    let state = advanceLiquid(liquidAt({center: 50, width: 90}), {center: 300, width: 180}, .08)
    const target = {center: 200, width: 110}
    for (let i = 0; i < 120; i++) state = advanceLiquid(state, target, 1 / 60)
    expect(liquidSettled(state, target)).toBe(true)
  })
  it('settles long background gaps without a giant spring impulse', () => {
    const target = {center: 250, width: 130}
    expect(advanceLiquid({...liquidAt({center: 10, width: 60}), velocity: 900}, target, 20)).toEqual(liquidAt(target))
  })
  it('ignores invalid or reversed elapsed time', () => {
    const state = liquidAt({center: 50, width: 80})
    for (const dt of [0, -1, NaN, Infinity]) expect(advanceLiquid(state, {center: 100, width: 70}, dt)).toBe(state)
  })
  it('creates one bounded closed contour, including at full stretch and reverse velocity', () => {
    for (const velocity of [-2000, 0, 2000]) {
      const path = liquidPath({...liquidAt({center: 100, width: 150}), stretch: 26, velocity}, 48, 210)
      expect(path.match(/M /g)).toHaveLength(1)
      expect(path.endsWith(' Z')).toBe(true)
      expect(path).not.toMatch(/NaN|Infinity/)
      const numbers = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
      expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...numbers)).toBeLessThanOrEqual(210)
    }
  })
  it('deforms continuously and recovers the resting capsule', () => {
    const state = liquidAt({center: 100, width: 120})
    expect(liquidPath({...state, velocity: 400, stretch: 12}, 48, 400)).not.toBe(liquidPath(state, 48, 400))
    expect(liquidPath(state, 0, 0)).toBe('')
  })
})

describe('segmented selection semantics', () => {
  const options = [{value: 'one', label: 'Chat'}, {value: 'two', label: 'A longer source label'}, {value: 'three', label: 'Disabled', disabled: true}]
  const markup = (value: string, disabled = false) => renderToStaticMarkup(createElement(LiquidPillGroup, {options, value, label: 'Workspace view', disabled, onChange: () => {}}))
  it('SSR declares exactly one selected option and one decorative indicator', () => {
    const html = markup('one')
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(html.match(/data-liquid-indicator/g)).toHaveLength(1)
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-label="Workspace view"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('focusable="false"')
  })
  it('keeps native button activation for click, touch, space and enter', () => {
    const html = markup('two')
    expect(html.match(/type="button" role="radio"/g)).toHaveLength(3)
    expect(html).toContain('data-liquid-value="two"')
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html).toContain('A longer source label')
  })
  it('uses a valid initial state after a dynamic option removal or disabled selection', () => {
    expect(markup('missing')).toContain('aria-checked="true" tabindex="0" data-liquid-value="one"')
    expect(markup('three')).toContain('aria-checked="true" tabindex="0" data-liquid-value="one"')
  })
  it('disables keyboard entry for a disabled group', () => {
    expect(markup('one', true)).toContain('aria-disabled="true"')
    expect(markup('one', true)).not.toContain('tabindex="0"')
  })
  it('skips disabled options, wraps, and supports Home/End', () => {
    expect(nextLiquidOption(options, 1, 'ArrowRight')).toBe(0)
    expect(nextLiquidOption(options, 0, 'ArrowLeft')).toBe(1)
    expect(nextLiquidOption(options, 0, 'End')).toBe(1)
    expect(nextLiquidOption(options, 1, 'Home')).toBe(0)
    expect(nextLiquidOption(options, 0, 'ArrowDown')).toBe(1)
    expect(nextLiquidOption(options, 1, 'ArrowUp')).toBe(0)
    expect(nextLiquidOption(options, 1, 'Escape')).toBe(1)
    expect(nextLiquidOption([{disabled: true}], 0, 'ArrowRight')).toBe(-1)
  })
})
