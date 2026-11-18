import {workspaceEnabled} from './workspace-config'

/** Only the boolean availability flag crosses the server/client boundary. */
export function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  return workspaceEnabled() && clientId && clientSecret ? {clientId, clientSecret} : null
}
