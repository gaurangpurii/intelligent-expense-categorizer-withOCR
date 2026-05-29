import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret')
const COOKIE = 'sec_session'
const TTL_DAYS = 30

export async function signSession(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TTL_DAYS}d`)
    .sign(SECRET)
}

export async function verifySession(token) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload
  } catch (e) {
    return null
  }
}

export async function getCurrentUser() {
  const c = cookies()
  const token = c.get('sec_session')?.value
  return await verifySession(token)
}

export function setSessionCookie(res, token) {
  res.cookies.set('sec_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * TTL_DAYS,
  })
  return res
}

export function clearSessionCookie(res) {
  res.cookies.set('sec_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 0,
  })
  return res
}

export const COOKIE_NAME = COOKIE
