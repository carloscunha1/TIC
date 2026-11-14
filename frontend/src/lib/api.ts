export type LoginPayload = { email: string; password: string };

export type ApiErrorResponse = {
  success: false;
  message: string;
  code: string;
  details: Record<string, unknown>;
};

export type CurrentSession = {
  email: string;
  expiresAt: string;
  name: string;
  permissions: string[];
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  userId: string;
};

export async function getCurrentSession(): Promise<CurrentSession> {
  const response = await fetch('/api/v1/auth/session', { credentials: 'include' });
  if (!response.ok) throw new Error('UNAUTHENTICATED');
  const body = (await response.json()) as { data: CurrentSession };
  return body.data;
}

export async function login(payload: LoginPayload): Promise<void> {
  const response = await fetch('/api/v1/auth/login', {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(error?.message ?? 'Não foi possível autenticar.');
  }
}
