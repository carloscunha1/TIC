import type { Response } from 'express';

export const SESSION_COOKIE_NAME = 'tic_session';

const sessionCookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

export function setSessionCookie(response: Response, token: string, expiresAt: Date): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions,
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
}

export function readSessionCookie(cookieHeader: string | undefined): string | null {
  const value = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  return value ? decodeURIComponent(value.slice(SESSION_COOKIE_NAME.length + 1)) : null;
}
