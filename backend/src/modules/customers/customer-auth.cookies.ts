import type { Response } from 'express';
export const CUSTOMER_SESSION_COOKIE = 'tic_customer_session';
const options = { httpOnly: true, path: '/', sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' };
export function setCustomerSessionCookie(response: Response, token: string, expiresAt: Date) { response.cookie(CUSTOMER_SESSION_COOKIE, token, { ...options, maxAge: Math.max(0, expiresAt.getTime() - Date.now()) }); }
export function clearCustomerSessionCookie(response: Response) { response.clearCookie(CUSTOMER_SESSION_COOKIE, options); }
export function readCustomerSessionCookie(header?: string) { const part = header?.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${CUSTOMER_SESSION_COOKIE}=`)); return part ? decodeURIComponent(part.slice(CUSTOMER_SESSION_COOKIE.length + 1)) : undefined; }
