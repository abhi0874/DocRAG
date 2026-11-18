import {lensNormalField} from '@/lib/ui/lens-normal'

/** Three bevelled sheets. Only the engraved lines on the top sheet are displaced. */
export function GlassFolio({id, className, displacement}: {
  id: string; className: string; displacement: number
}) {
  const fill = (name: string) => `url(#${id}-${name})`
  const sheet = 'M34 75 Q27 71 35 67 L133 22 Q139 19 146 22 L211 49 Q218 52 211 57 L114 106 Q108 109 102 106 Z'
  return <svg className={`optical-mark ${className}`} viewBox="0 0 248 178" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-face`} x2=".82" y2="1">
        <stop stopColor="var(--platinum)" stopOpacity=".96"/>
        <stop offset=".34" stopColor="var(--titanium)" stopOpacity=".84"/>
        <stop offset=".66" stopColor="var(--card)" stopOpacity=".78"/>
        <stop offset="1" stopColor="var(--glacier)"/>
      </linearGradient>
      <linearGradient id={`${id}-bevel`}>
        <stop stopColor="var(--optic-ink)"/><stop offset=".38" stopColor="var(--glacier)"/>
        <stop offset=".43" stopColor="var(--platinum)"/><stop offset=".48" stopColor="var(--optic-ink)"/>
        <stop offset="1" stopColor="var(--titanium)"/>
      </linearGradient>
      <radialGradient id={`${id}-shadow`}><stop stopColor="var(--optic-ink)" stopOpacity=".42"/><stop offset="1" stopColor="var(--optic-ink)" stopOpacity="0"/></radialGradient>
      <pattern id={`${id}-ruling`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(23)"><path d="M0 0 V6" stroke="var(--optic-ink)" strokeOpacity=".5" strokeWidth=".85"/></pattern>
      <clipPath id={`${id}-clip`}><path d={sheet}/></clipPath>
      <filter id={`${id}-bend`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={lensNormalField} x="30" y="20" width="186" height="90" preserveAspectRatio="none" result="normal"/>
        <feDisplacementMap in="SourceGraphic" in2="normal" scale={displacement} xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>
    <ellipse cx="127" cy="132" rx="105" ry="25" transform="rotate(-10 127 132)" fill={fill('shadow')}/>
    {[44,22,0].map(offset=><g key={offset} transform={`translate(0 ${offset})`}>
      <path d={sheet} transform="translate(0 4)" fill={fill('bevel')} stroke="var(--optic-ink)" strokeOpacity=".45"/>
      <path d={sheet} fill={fill('face')} stroke="var(--platinum)" strokeWidth="1.2"/>
      {offset===0 && <g clipPath={fill('clip')}>
        <path d="M11 63L157 2 187 23 42 92Z" fill={fill('ruling')} filter={displacement ? fill('bend') : undefined}/>
        <path d="M72 84l91-42m-78 48 65-30m-51 35 40-19" stroke="var(--optic-ink)" strokeWidth="1.6" opacity=".64"/>
        <path d="M22 55L143 2l24 9L42 70z" fill="white" opacity="var(--glass-highlight)"/>
      </g>}
      <path d="M36 74l67 30q5 3 11 0l44-22" fill="none" stroke="var(--platinum)" strokeWidth="1.35"/>
    </g>)}
  </svg>
}
