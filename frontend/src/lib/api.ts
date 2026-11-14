export type LoginPayload = { email: string; password: string };

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api/v1').replace(/\/$/, '');

function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

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
  const response = await fetch(apiUrl('/auth/session'), { credentials: 'include' });
  if (!response.ok) throw new Error('UNAUTHENTICATED');
  const body = (await response.json()) as { data: CurrentSession };
  return body.data;
}

export type CreateUserPayload = {
  email: string;
  name: string;
  password: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
};

export async function createUser(payload: CreateUserPayload): Promise<void> {
  const response = await fetch(apiUrl('/users'), {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(error?.message ?? 'Não foi possível criar o usuário.');
  }
}

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
};

export type UserListParams = {
  page: number;
  pageSize: number;
  search?: string;
  role?: UserListItem['role'];
  status?: UserListItem['status'];
};

export type UserListResponse = {
  users: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listUsers(params: UserListParams): Promise<UserListResponse> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.status) query.set('status', params.status);
  const response = await fetch(`${apiUrl('/users')}?${query.toString()}`, { credentials: 'include' });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(error?.message ?? 'Não foi possível consultar os usuários.');
  }
  const body = (await response.json()) as { data: UserListResponse };
  return body.data;
}

export async function login(payload: LoginPayload): Promise<void> {
  const response = await fetch(apiUrl('/auth/login'), {
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

export async function logout(): Promise<void> {
  const response = await fetch(apiUrl('/auth/logout'), {
    credentials: 'include',
    method: 'POST',
  });
  if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
}
