'use client'

import {useId} from 'react'
import {lensNormalField} from '@/lib/ui/lens-normal'
import {useGlassDisplacement} from '@/components/appearance'

/** The loupe samples only the artwork beneath its footprint, never text or form fields. */
export function OpticalPlate({className=''}: {className?: string}) {
  const id = useId().replaceAll(':','')
  const displacement = useGlassDisplacement()
  const url = (part:string) => `url(#${id}-${part})`
  return <div className={`optical-plate ${className}`} aria-hidden="true">
    <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <clipPath id={`${id}-clip`}><circle cx="401" cy="186" r="67"/></clipPath>
        <filter id={`${id}-bend`} filterUnits="userSpaceOnUse" x="331" y="116" width="140" height="140" colorInterpolationFilters="sRGB">
          <feImage href={lensNormalField} x="331" y="116" width="140" height="140" result="normal"/>
          <feDisplacementMap in="SourceGraphic" in2="normal" scale={displacement} xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <linearGradient id={`${id}-rim`} x2=".8" y2="1">
          <stop stopColor="#fff"/><stop offset=".32" stopColor="#e1f1ec" stopOpacity=".15"/>
          <stop offset=".69" stopColor="#354d45" stopOpacity=".62"/><stop offset="1" stopColor="#fff"/>
        </linearGradient>
        <image id={`${id}-scene`} href="/optics/folio.webp" width="600" height="400" preserveAspectRatio="xMidYMid slice"/>
      </defs>
      <use href={`#${id}-scene`}/>
      <g className="optical-loupe">
        <g clipPath={url('clip')}><g filter={displacement ? url('bend') : undefined}>
          <use href={`#${id}-scene`} transform="translate(401 186) scale(1.12) translate(-401 -186)"/>
        </g></g>
        <circle cx="401" cy="186" r="67" fill="none" stroke={url('rim')} strokeWidth="3"/>
        <circle cx="401" cy="186" r="63" fill="none" stroke="white" strokeOpacity=".25"/>
      </g>
    </svg>
  </div>
}
