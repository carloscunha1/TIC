export type LoginPayload = { email: string; password: string };

export type ApiErrorResponse = {
  success: false;
  message: string;
  code: string;
  details: Record<string, unknown>;
};

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
