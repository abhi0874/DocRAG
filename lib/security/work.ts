import {HttpError} from './http'
let active=0
export function acquireWork(){if(active>=2)throw new HttpError(429,'Server is busy; try again shortly',5);active++
  let done=false;return ()=>{if(!done){done=true;active--}}
}
