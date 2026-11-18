/** Explicit rollout switch: sample-only deployment remains the default. */
export function workspaceEnabled() {
  return process.env.DOCRAG_WORKSPACE_ENABLED === 'true'
}
export const workspaceLimits = {
  fileBytes: 2 * 1024 * 1024, chunksPerDocument: 12,
  documentsPerUser: 3, documentsGlobal: 50, retentionDays: 30,
} as const
