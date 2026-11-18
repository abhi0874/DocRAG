'use client'
import {createContext,useContext,useEffect,useRef,useState,useId} from 'react'
import {SlidersHorizontal,X,Sun,Moon} from 'lucide-react'
import {appearanceKey,defaultAppearance,opticalParameters,parseAppearance,type Appearance} from '@/lib/ui/appearance'
import {advanceLiquid,liquidAt} from '@/lib/ui/liquid-physics'
import {lensNormalField} from '@/lib/ui/lens-normal'
import {GlassFolio} from './ui/glass-folio'
import {LiquidPillGroup} from './ui/liquid-pill-group'
const Context=createContext({appearance:defaultAppearance,setAppearance:(_value:Appearance)=>{void _value}})
export function AppearanceProvider({children}:{children:React.ReactNode}) {
  const [appearance,setAppearance]=useState<Appearance | null>(null)
  useEffect(()=>{
    const sync=()=>{try{setAppearance(parseAppearance(localStorage.getItem(appearanceKey)))}catch{setAppearance(defaultAppearance)}}
    sync();window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)
  },[])
  useEffect(()=>{
    if (!appearance) return
    const media=window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const root = document.documentElement
      const {theme, intensity, reduceMotion} = appearance
      root.dataset.motion = reduceMotion ? 'reduce' : 'system'
      root.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      root.style.setProperty('--glass-level', String(intensity / 100))
      root.dataset.glass = intensity < 25 ? 'low' : intensity > 75 ? 'high' : 'balanced'
    }
    apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply)
  },[appearance])
  function update(value:Appearance){setAppearance(value);try{localStorage.setItem(appearanceKey,JSON.stringify(value))}catch{/* Preferences remain usable when storage is unavailable. */}}
  return <Context.Provider value={{appearance:appearance ?? defaultAppearance,setAppearance:update}}>{children}<ThemeToggle/>
    <svg width="0" height="0" className="material-definitions" aria-hidden="true" focusable="false">
      <filter id="docrag-control-edge" colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
        <feImage href={lensNormalField} width="100%" height="100%" preserveAspectRatio="none" result="normal"/>
        <feDisplacementMap in="SourceGraphic" in2="normal" xChannelSelector="R" yChannelSelector="G" scale={opticalParameters((appearance ?? defaultAppearance).intensity).displacement * .4}/>
      </filter>
    </svg>
  </Context.Provider>
}
// Sample the navigation lens spring once; CSS interpolates on the compositor.
const springTarget={center:1,width:1}
let springState=liquidAt({center:0,width:1})
const toggleSpring='linear(0,'+Array.from({length:24},()=>{
  springState=advanceLiquid(springState,springTarget,1/60)
  return springState.center.toFixed(4)
}).join(',')+',1)'
export function ThemeToggle(){
  const {appearance,setAppearance}=useContext(Context)
  const toggle=()=>{
    const dark=document.documentElement.dataset.theme==='dark' ||
      (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
    setAppearance({...appearance,theme:dark?'light':'dark'})
  }
  return <button type="button" className="global-theme glass-surface" style={{'--theme-spring':toggleSpring} as React.CSSProperties} onClick={toggle} aria-label="Switch light or dark theme">
    <Sun aria-hidden="true" className="theme-sun" size={20}/><Moon aria-hidden="true" className="theme-moon" size={20}/>
  </button>
}
/** Bounded decorative optical study: only public vector artwork is displaced. */
export function useGlassDisplacement() {
  const {appearance} = useContext(Context)
  return opticalParameters(appearance.intensity).displacement
}
export function OpticalMark({className=''}:{className?:string}){
  const id = useId().replaceAll(':', '')
  const displacement = useGlassDisplacement()
  return <GlassFolio id={id} className={className} displacement={displacement}/>
}
export function AppearanceControl(){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null)
 const {appearance,setAppearance}=useContext(Context)
 const [preview,setPreview]=useState('balanced')
 const close=()=>{dialog.current?.close();trigger.current?.focus()}
 return <>
  <button ref={trigger} className="icon-button" aria-label="Appearance settings" onClick={()=>dialog.current?.showModal()}><SlidersHorizontal size={18}/></button>
  <dialog ref={dialog} className="appearance-dialog" aria-labelledby="appearance-title" onClick={e=>{if(e.target===e.currentTarget)close()}} onClose={()=>trigger.current?.focus()}>
   <div className="appearance-content">
    <div className="appearance-heading"><h2 id="appearance-title" className="display-title text-3xl">Light & material.</h2><ThemeToggle/><button className="icon-button" onClick={close} aria-label="Close appearance settings"><X size={18}/></button></div>
    <div className="appearance-preview glass-surface"><OpticalMark/></div>
    <div><p className="setting-label">Color theme</p><LiquidPillGroup label="Color theme" options={[{value:'light',label:'Light'},{value:'dark',label:'Dark'},{value:'system',label:'System'}]} value={appearance.theme} onChange={theme=>setAppearance({...appearance,theme:theme as Appearance['theme']})}/></div>
    <div><div className="flex justify-between gap-3"><label htmlFor="glass-intensity" className="setting-label">Liquid Glass Intensity</label><output htmlFor="glass-intensity" className="font-mono text-sm">{appearance.intensity}%</output></div><input id="glass-intensity" type="range" min="0" max="100" value={appearance.intensity} onChange={e=>setAppearance({...appearance,intensity:Number(e.target.value)})} aria-describedby="glass-help"/><div className="flex justify-between text-xs text-muted-foreground"><button className="intensity-preset" onClick={()=>setAppearance({...appearance,intensity:0})}>Low</button><button className="intensity-preset" onClick={()=>setAppearance({...appearance,intensity:55})}>Balanced</button><button className="intensity-preset" onClick={()=>setAppearance({...appearance,intensity:100})}>High</button></div><p id="glass-help" className="mt-3 text-xs leading-relaxed text-muted-foreground">Adjust the lens, reflections and surface depth. Your reading surface stays clear. Reduced-motion preferences are respected.</p></div>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={appearance.reduceMotion} onChange={e=>setAppearance({...appearance,reduceMotion:e.target.checked})} className="size-4 accent-[var(--primary)]"/>Reduce motion in DocRAG</label>
    <div><p className="setting-label">Try the liquid selector</p><LiquidPillGroup label="Material preview" value={preview} onChange={setPreview} options={[{value:'low',label:'Quiet'},{value:'balanced',label:'Balanced'},{value:'high',label:'Expressive'}]}/></div>
   </div>
  </dialog>
 </>
}
