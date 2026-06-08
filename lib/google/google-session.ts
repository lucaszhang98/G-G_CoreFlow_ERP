/**
 * 通过 Google 账号密码获取会话 Cookie，用于拉取 Sheets 导出。
 * 注意：若账号开启了两步验证或触发风控，此方式可能失败。
 */
export async function getGoogleSessionCookies(email: string, password: string): Promise<string> {
  const initRes = await fetch('https://accounts.google.com/ServiceLogin?passive=true&continue=https://www.google.com/', {
    redirect: 'manual',
  })
  const initCookies = collectCookies(initRes)

  const identifierRes = await fetch('https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: initCookies,
    },
    body: new URLSearchParams({
      Email: email,
      continue: 'https://www.google.com/',
    }).toString(),
    redirect: 'manual',
  })
  const identifierCookies = mergeCookies(initCookies, collectCookies(identifierRes))

  const passwordRes = await fetch('https://accounts.google.com/signin/v2/challenge/password/empty?flowName=GlifWebSignIn&flowEntry=ServiceLogin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: identifierCookies,
    },
    body: new URLSearchParams({
      Email: email,
      Passwd: password,
      continue: 'https://www.google.com/',
    }).toString(),
    redirect: 'manual',
  })

  const finalCookies = mergeCookies(identifierCookies, collectCookies(passwordRes))
  if (!finalCookies) {
    throw new Error('Google 登录未返回有效 Cookie')
  }

  const location = passwordRes.headers.get('location') || ''
  if (location.includes('challenge') || location.includes('signin')) {
    throw new Error('Google 登录需要额外验证（如二次验证），明文密码方式无法完成')
  }

  return finalCookies
}

function collectCookies(response: Response): string {
  const cookies: string[] = []
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const part = value.split(';')[0]
      if (part) cookies.push(part)
    }
  })
  return cookies.join('; ')
}

function mergeCookies(...parts: string[]): string {
  const map = new Map<string, string>()
  for (const part of parts) {
    for (const cookie of part.split(';').map((c) => c.trim()).filter(Boolean)) {
      const eq = cookie.indexOf('=')
      if (eq > 0) {
        map.set(cookie.slice(0, eq), cookie)
      }
    }
  }
  return Array.from(map.values()).join('; ')
}
