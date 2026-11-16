export type ThemePreference = 'system' | 'dark' | 'light'
export type Appearance = {theme: ThemePreference; intensity: number; reduceMotion: boolean}
export const appearanceKey = 'docrag.mono-glass.v1'
export const defaultAppearance: Appearance = {theme:'system',intensity:55,reduceMotion:false}
export function parseAppearance(raw: string | null): Appearance {
  try {
    const p = JSON.parse(raw ?? '{}')
    return {theme:['system','dark','light'].includes(p?.theme) ? p.theme : 'system',intensity:typeof p?.intensity==='number' && Number.isFinite(p.intensity) ? Math.max(0,Math.min(100,p.intensity)) : 55,reduceMotion:p?.reduceMotion===true}
  } catch {return defaultAppearance}
}
export function opticalParameters(intensity: number) {
  const n=Math.max(0,Math.min(100,Number.isFinite(intensity)?intensity:55))/100
  return {blur:2+10*n,highlight:.12+.28*n,displacement:18*n,opacity:.96-.16*n}
}
