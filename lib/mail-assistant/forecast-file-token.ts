import crypto from 'crypto'

export type ForecastFileTokenPayload = {
  kind: 'source' | 'import'
  containerNumber: string
}

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || 'forecast-file-dev-secret'
}

export function signForecastFileToken(
  payload: ForecastFileTokenPayload,
  ttlSeconds = 600
): string {
  const body = {
    ...payload,
    containerNumber: payload.containerNumber.trim().toUpperCase(),
    exp: Date.now() + ttlSeconds * 1000,
  }
  const json = JSON.stringify(body)
  const sig = crypto.createHmac('sha256', getSecret()).update(json).digest('base64url')
  return Buffer.from(JSON.stringify({ body: json, sig })).toString('base64url')
}

export function verifyForecastFileToken(token: string): ForecastFileTokenPayload | null {
  try {
    const wrapped = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as {
      body: string
      sig: string
    }
    const expected = crypto.createHmac('sha256', getSecret()).update(wrapped.body).digest('base64url')
    if (expected !== wrapped.sig) return null
    const parsed = JSON.parse(wrapped.body) as ForecastFileTokenPayload & { exp: number }
    if (!parsed.exp || Date.now() > parsed.exp) return null
    if (parsed.kind !== 'source' && parsed.kind !== 'import') return null
    if (!parsed.containerNumber) return null
    return { kind: parsed.kind, containerNumber: parsed.containerNumber }
  } catch {
    return null
  }
}

export function buildOfficeOnlineEmbedUrl(publicFileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicFileUrl)}`
}
