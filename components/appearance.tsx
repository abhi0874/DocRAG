'use client'
import {createContext,useContext,useEffect,useRef,useState,useId} from 'react'
import {SlidersHorizontal,X} from 'lucide-react'
import {appearanceKey,defaultAppearance,opticalParameters,parseAppearance,type Appearance} from '@/lib/ui/appearance'
import {lensNormalField} from '@/lib/ui/lens-normal'
import {LiquidPillGroup} from './ui/liquid-pill-group'
const Context=createContext({appearance:defaultAppearance,setAppearance:(_value:Appearance)=>{void _value}})
export function AppearanceProvider({children}:{children:React.ReactNode}) {
  const [appearance,setAppearance]=useState(defaultAppearance)
  useEffect(()=>{
    const sync=()=>{try{setAppearance(parseAppearance(localStorage.getItem(appearanceKey)))}catch{setAppearance(defaultAppearance)}}
    sync();window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)
  },[])
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)')
    const apply=()=>{document.documentElement.dataset.motion=appearance.reduceMotion?'reduce':'system';document.documentElement.dataset.theme=appearance.theme==='system'?(media.matches?'dark':'light'):appearance.theme; const p=opticalParameters(appearance.intensity); const s=document.documentElement.style;s.setProperty('--glass-blur',`${p.blur}px`);s.setProperty('--glass-highlight',String(p.highlight));s.setProperty('--glass-opacity',String(p.opacity));document.documentElement.dataset.glass=appearance.intensity<25?'low':appearance.intensity>75?'high':'balanced'}
    apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply)
  },[appearance])
  function update(value:Appearance){setAppearance(value);try{localStorage.setItem(appearanceKey,JSON.stringify(value))}catch{/* Preferences remain usable when storage is unavailable. */}}
  return <Context.Provider value={{appearance,setAppearance:update}}>{children}</Context.Provider>
}
/** Bounded decorative optical study: only public vector artwork is displaced. */
export function OpticalMark({className=''}:{className?:string}){
  const id=useId().replaceAll(':',''),{appearance}=useContext(Context)
  const {displacement}=opticalParameters(appearance.intensity)
  return <svg className={`optical-mark ${className}`} viewBox="0 0 240 180" aria-hidden="true" focusable="false">
    <defs>
      <pattern id={`${id}-lines`} width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><path d="M0 0V13" stroke="currentColor" strokeWidth="1" opacity=".25"/></pattern>
      <radialGradient id={`${id}-edge`} cx="36%" cy="22%" r="85%"><stop stopColor="white" stopOpacity=".45"/><stop offset=".35" stopColor="white" stopOpacity=".015"/><stop offset=".8" stopColor="white" stopOpacity=".04"/><stop offset="1" stopColor="white" stopOpacity=".28"/></radialGradient>
      <filter id={`${id}-bend`} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB"><feImage href={lensNormalField} x="36" y="12" width="168" height="156" preserveAspectRatio="none" result="normal"/><feDisplacementMap in="SourceGraphic" in2="normal" scale={displacement} xChannelSelector="R" yChannelSelector="G"/></filter>
      <clipPath id={`${id}-clip`}><rect x="49" y="26" width="142" height="128" rx="64"/></clipPath>
    </defs>
    <path d="M8 141H232M8 40H232" stroke="currentColor" opacity=".12"/>
    <rect x="12" y="12" width="216" height="156" fill={`url(#${id}-lines)`}/>
    <g clipPath={`url(#${id}-clip)`}><rect x="36" y="12" width="168" height="156" fill={`url(#${id}-lines)`} filter={appearance.intensity>0?`url(#${id}-bend)`:undefined}/><rect x="49" y="26" width="142" height="128" rx="64" fill={`url(#${id}-edge)`}/></g>
    <rect x="49" y="26" width="142" height="128" rx="64" fill="none" stroke="currentColor" strokeOpacity=".25"/>
    <path d="M65 71C70 43 93 32 124 32" fill="none" stroke="white" strokeOpacity=".65" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M176 111C168 137 148 147 119 148" fill="none" stroke="currentColor" strokeOpacity=".3"/>
    <path d="M110 90H130M120 80V100" stroke="var(--primary)" strokeWidth="2"/>
  </svg>
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
    <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Make it yours</p><h2 id="appearance-title" className="display-title text-3xl">Light & material.</h2></div><button className="icon-button" onClick={close} aria-label="Close appearance settings"><X size={18}/></button></div>
    <div className="appearance-preview glass-surface"><OpticalMark/><span className="eyebrow">Optical study / 01</span></div>
    <div><p className="setting-label">Color theme</p><LiquidPillGroup label="Color theme" options={[{value:'light',label:'Light'},{value:'dark',label:'Dark'},{value:'system',label:'System'}]} value={appearance.theme} onChange={theme=>setAppearance({...appearance,theme:theme as Appearance['theme']})}/></div>
    <div><div className="flex justify-between gap-3"><label htmlFor="glass-intensity" className="setting-label">Liquid Glass Intensity</label><output htmlFor="glass-intensity" className="font-mono text-sm">{appearance.intensity}%</output></div><input id="glass-intensity" type="range" min="0" max="100" value={appearance.intensity} onChange={e=>setAppearance({...appearance,intensity:Number(e.target.value)})} aria-describedby="glass-help"/><div className="flex justify-between text-xs text-muted-foreground"><button className="intensity-preset" onClick={()=>setAppearance({...appearance,intensity:0})}>Low</button><button className="intensity-preset" onClick={()=>setAppearance({...appearance,intensity:55})}>Balanced</button><button className="intensity-preset" onClick={()=>setAppearance({...appearance,intensity:100})}>High</button></div><p id="glass-help" className="mt-3 text-xs leading-relaxed text-muted-foreground">Adjust the lens, reflections and surface depth. Your reading surface stays clear. Reduced-motion preferences are respected.</p></div>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={appearance.reduceMotion} onChange={e=>setAppearance({...appearance,reduceMotion:e.target.checked})} className="size-4 accent-[var(--primary)]"/>Reduce motion in DocRAG</label>
    <div><p className="setting-label">Try the liquid selector</p><LiquidPillGroup label="Material preview" value={preview} onChange={setPreview} options={[{value:'low',label:'Quiet'},{value:'balanced',label:'Balanced'},{value:'high',label:'Expressive'}]}/></div>
   </div>
  </dialog>
 </>
}
