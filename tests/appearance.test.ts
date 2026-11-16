import {describe,it,expect} from 'vitest'
import {parseAppearance,opticalParameters} from '../lib/ui/appearance'
describe('appearance preferences',()=>{
 it('uses balanced system defaults for missing/corrupt storage',()=>{for(const raw of [null,'oops','null','[]','{}'])expect(parseAppearance(raw)).toEqual({theme:'system',intensity:55,reduceMotion:false})})
 it('bounds preferences and rejects unknown themes',()=>{expect(parseAppearance('{"theme":"bad","intensity":200}')).toEqual({theme:'system',intensity:100,reduceMotion:false});expect(parseAppearance('{"theme":"dark","intensity":-1}')).toEqual({theme:'dark',intensity:0,reduceMotion:false})})
 it('preserves both themes and intermediate slider values',()=>{for(const theme of ['light','dark','system'])expect(parseAppearance(JSON.stringify({theme,intensity:77}))).toEqual({theme,intensity:77,reduceMotion:false})})
 it('allows reduced motion without disabling system preferences',()=>{expect(parseAppearance('{"reduceMotion":true}').reduceMotion).toBe(true);expect(parseAppearance('{"reduceMotion":"false"}').reduceMotion).toBe(false)})
 it('changes optical displacement, highlight and blur, within bounded cost',()=>{const low=opticalParameters(0),balanced=opticalParameters(55),high=opticalParameters(100);expect(low.displacement).toBe(0);for(const key of ['blur','highlight','displacement'] as const){expect(low[key]).toBeLessThan(balanced[key]);expect(balanced[key]).toBeLessThan(high[key])}expect(high.blur).toBe(12);expect(high.displacement).toBe(18);expect(opticalParameters(NaN)).toEqual(balanced)})
})
