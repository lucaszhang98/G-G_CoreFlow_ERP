export function buildForecastFilePageUrl(
  kind: 'source' | 'import',
  containerNumber: string
): string {
  const params = new URLSearchParams({
    kind,
    containerNumber: containerNumber.trim().toUpperCase(),
  })
  return `/dashboard/settings/mail-assistant/forecast-file?${params.toString()}`
}
