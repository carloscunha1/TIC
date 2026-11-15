export type LoginPayload = { email: string; password: string };

export async function createProduct(payload: { name: string; description?: string; barcode?: string; categoryId: string; unit: 'UN' | 'KG' | 'G' | 'L' | 'ML'; cost: number; salePrice: number; minimumStock: number; stockMode: 'SIMPLES' | 'LOTE'; expirationAlertDays: number }): Promise<void> { const response = await fetch(apiUrl('/products'), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'POST' }); if (!response.ok) { const error = await response.json().catch(() => null) as { message?: string } | null; throw new Error(error?.message ?? 'Não foi possível criar o produto.'); } }

export type ProductListItem = { id: string; sku: string; name: string; description: string | null; barcode: string | null; categoryId: string; unit: 'UN' | 'KG' | 'G' | 'L' | 'ML'; salePrice: string; minimumStock: string; stockBalance: string | null; stockMode: 'SIMPLES' | 'LOTE'; expirationAlertDays: number; status: 'ACTIVE' | 'INACTIVE' };
export async function listProducts(params: { page: number; pageSize: number; search?: string; categoryId?: string; status?: ProductListItem['status']; stockMode?: ProductListItem['stockMode'] }): Promise<{ products: ProductListItem[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.search) query.set('search', params.search);
  if (params.categoryId) query.set('categoryId', params.categoryId);
  if (params.status) query.set('status', params.status);
  if (params.stockMode) query.set('stockMode', params.stockMode);
  const response = await fetch(`${apiUrl('/products')}?${query.toString()}`, { credentials: 'include' });
  if (!response.ok) throw new Error('Não foi possível consultar os produtos.');
  const body = await response.json() as { data: { products: ProductListItem[]; total: number; page: number; pageSize: number; totalPages: number } };
  return body.data;
}

export type ProductDetail = Omit<ProductListItem, 'salePrice' | 'minimumStock'> & { cost: string; salePrice: string; minimumStock: string; createdAt: string; updatedAt: string };
export async function getProduct(id: string): Promise<ProductDetail> {
  const response = await fetch(apiUrl(`/products/${id}`), { credentials: 'include' });
  if (!response.ok) throw new Error('Não foi possível carregar o produto.');
  const body = await response.json() as { data: { product: ProductDetail } };
  return body.data.product;
}
export async function updateProduct(id: string, payload: { name: string; description?: string; barcode?: string; categoryId: string; unit: ProductListItem['unit']; cost: number; salePrice: number; minimumStock: number; stockMode: ProductListItem['stockMode']; expirationAlertDays: number }): Promise<void> {
  const response = await fetch(apiUrl(`/products/${id}`), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'PATCH' });
  if (!response.ok) { const error = await response.json().catch(() => null) as { message?: string } | null; throw new Error(error?.message ?? 'Não foi possível atualizar o produto.'); }
}
export async function updateProductStatus(id: string, status: ProductListItem['status']): Promise<void> {
  const response = await fetch(apiUrl(`/products/${id}/status`), { body: JSON.stringify({ status }), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'PATCH' });
  if (!response.ok) { const error = await response.json().catch(() => null) as { message?: string } | null; throw new Error(error?.message ?? 'Não foi possível atualizar o status do produto.'); }
}
export type ProductValueHistoryItem = { id: string; field: 'SALE_PRICE' | 'COST'; previousValue: string; newValue: string; source: string; sourceId: string | null; changedByUserId: string | null; changedByUser: { name: string } | null; changedAt: string };
export async function getProductValueHistory(id: string): Promise<ProductValueHistoryItem[]> {
  const response = await fetch(apiUrl(`/products/${id}/value-history`), { credentials: 'include' });
  if (!response.ok) throw new Error('Não foi possível carregar o histórico de valores.');
  const body = await response.json() as { data: { history: ProductValueHistoryItem[] } };
  return body.data.history;
}

export async function createSupplier(payload: { name: string; document?: string; phone?: string; email?: string; notes?: string }): Promise<void> {
  const response = await fetch(apiUrl('/suppliers'), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'POST' });
  if (!response.ok) { const error = (await response.json().catch(() => null)) as ApiErrorResponse | null; throw new Error(error?.message ?? 'Não foi possível criar o fornecedor.'); }
}

export type SupplierListItem = { id: string; name: string; document: string | null; phone: string | null; email: string | null; notes: string | null; status: 'ACTIVE' | 'INACTIVE'; createdAt: string };
export async function listSuppliers(params: { page: number; pageSize: number; name?: string; status?: SupplierListItem['status'] }): Promise<{ suppliers: SupplierListItem[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.name) query.set('name', params.name);
  if (params.status) query.set('status', params.status);
  const response = await fetch(`${apiUrl('/suppliers')}?${query.toString()}`, { credentials: 'include' });
  if (!response.ok) throw new Error('Não foi possível consultar os fornecedores.');
  const body = await response.json() as { data: { suppliers: SupplierListItem[]; total: number; page: number; pageSize: number; totalPages: number } };
  return body.data;
}

export async function getSupplier(id: string): Promise<SupplierListItem> { const response = await fetch(apiUrl(`/suppliers/${id}`), { credentials: 'include' }); if (!response.ok) throw new Error('Não foi possível carregar o fornecedor.'); const body = await response.json() as { data: { supplier: SupplierListItem } }; return body.data.supplier; }
export async function updateSupplier(id: string, payload: { name: string; document?: string; phone?: string; email?: string; notes?: string }): Promise<void> { const response = await fetch(apiUrl(`/suppliers/${id}`), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'PATCH' }); if (!response.ok) { const error = await response.json().catch(() => null) as { message?: string } | null; throw new Error(error?.message ?? 'Não foi possível atualizar o fornecedor.'); } }
export async function updateSupplierStatus(id: string, status: SupplierListItem['status']): Promise<void> { const response = await fetch(apiUrl(`/suppliers/${id}/status`), { body: JSON.stringify({ status }), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'PATCH' }); if (!response.ok) throw new Error('Não foi possível atualizar o status do fornecedor.'); }

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api/v1').replace(/\/$/, '');

function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

export async function createCategory(payload: { name: string; description?: string }): Promise<void> {
  const response = await fetch(apiUrl('/categories'), {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(error?.message ?? 'Não foi possível criar a categoria.');
  }
}

export type CategoryListItem = { id: string; name: string; description: string | null; status: 'ACTIVE' | 'INACTIVE'; createdAt: string };
export type CategoryListResponse = { categories: CategoryListItem[]; total: number; page: number; pageSize: number; totalPages: number };

export async function listCategories(params: { page: number; pageSize: number; name?: string; status?: CategoryListItem['status'] }): Promise<CategoryListResponse> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.name) query.set('name', params.name);
  if (params.status) query.set('status', params.status);
  const response = await fetch(`${apiUrl('/categories')}?${query.toString()}`, { credentials: 'include' });
  if (!response.ok) throw new Error('Não foi possível consultar as categorias.');
  const body = (await response.json()) as { data: CategoryListResponse };
  return body.data;
}

export async function getCategory(id: string): Promise<CategoryListItem> {
  const response = await fetch(apiUrl(`/categories/${id}`), { credentials: 'include' });
  if (!response.ok) throw new Error('Não foi possível carregar a categoria.');
  const body = (await response.json()) as { data: { category: CategoryListItem } };
  return body.data.category;
}

export async function updateCategory(id: string, payload: { name: string; description?: string }): Promise<void> {
  const response = await fetch(apiUrl(`/categories/${id}`), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'PATCH' });
  if (!response.ok) throw new Error('Não foi possível atualizar a categoria.');
}

export async function updateCategoryStatus(id: string, status: CategoryListItem['status']): Promise<void> {
  const response = await fetch(apiUrl(`/categories/${id}/status`), { body: JSON.stringify({ status }), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'PATCH' });
  if (!response.ok) throw new Error('Não foi possível atualizar o status da categoria.');
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

export async function getUser(id: string): Promise<UserListItem> {
  const response = await fetch(apiUrl(`/users/${id}`), { credentials: 'include' });
  if (!response.ok) throw new Error('Não foi possível carregar o usuário.');
  const body = (await response.json()) as { data: { user: UserListItem } };
  return body.data.user;
}

export async function updateUser(id: string, payload: Pick<UserListItem, 'name' | 'role'>): Promise<UserListItem> {
  const response = await fetch(apiUrl(`/users/${id}`), {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(error?.message ?? 'Não foi possível atualizar o usuário.');
  }
  const body = (await response.json()) as { data: { user: UserListItem } };
  return body.data.user;
}

export async function updateUserStatus(id: string, status: UserListItem['status']): Promise<UserListItem> {
  const response = await fetch(apiUrl(`/users/${id}/status`), {
    body: JSON.stringify({ status }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(error?.message ?? 'Não foi possível atualizar o status do usuário.');
  }
  const body = (await response.json()) as { data: { user: UserListItem } };
  return body.data.user;
}

export async function issuePasswordReset(id: string): Promise<{ token: string; expiresAt: string }> {
  const response = await fetch(apiUrl(`/users/${id}/password-reset`), { credentials: 'include', method: 'POST' });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(error?.message ?? 'Não foi possível gerar a credencial temporária.');
  }
  const body = (await response.json()) as { data: { token: string; expiresAt: string } };
  return body.data;
}

export async function completePasswordReset(payload: { token: string; password: string }): Promise<void> {
  const response = await fetch(apiUrl('/auth/password-reset/complete'), {
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(error?.message ?? 'Não foi possível definir a nova senha.');
  }
}

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
