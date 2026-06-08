export type WorkspaceCredentials = {
  email: string
  password: string
}

export function getWorkspaceCredentials(): WorkspaceCredentials | null {
  const email = process.env.GOOGLE_WORKSPACE_EMAIL?.trim()
  const password = process.env.GOOGLE_WORKSPACE_PASSWORD
  if (!email || !password) return null
  return { email, password }
}

export function isWorkspaceConfigured(): boolean {
  return getWorkspaceCredentials() !== null
}
