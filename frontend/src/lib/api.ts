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

export type CustomerView = { id: string; name: string; phone: string; status: 'PENDING_PIN' | 'ACTIVE'; privacyNoticeAcknowledgedAt: string; createdAt: string; updatedAt: string };
export async function createCustomer(payload: { name: string; phone: string; privacyNoticeAcknowledged: boolean }, quick = false): Promise<CustomerView> {
  const response = await fetch(apiUrl(`/customers${quick ? '/quick' : ''}`), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'POST' });
  if (!response.ok) { const error = await response.json().catch(() => null) as ApiErrorResponse | null; throw new Error(error?.message ?? 'Não foi possível cadastrar o cliente.'); }
  return (await response.json() as { data: { customer: CustomerView } }).data.customer;
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

export type EntryDraftItemInput = { productId: string; quantity: number; unitCost: number; lotIdentifier?: string; expirationDate?: string };
export type EntryDraftInput = { supplierId?: string | null; items: EntryDraftItemInput[] };
export type EntryItemView = Omit<EntryDraftItemInput, 'quantity' | 'unitCost' | 'lotIdentifier' | 'expirationDate'> & { id: string; quantity: string; unitCost: string; lotIdentifier: string | null; expirationDate: string | null; product: { id: string; name: string; unit: ProductListItem['unit']; stockMode: ProductListItem['stockMode'] } };
export type EntryView = { id: string; status: 'EM_ANDAMENTO' | 'CONFIRMADA' | 'CANCELADA'; supplierId: string | null; supplier: { id: string; name: string } | null; items: EntryItemView[]; createdAt: string; updatedAt: string };
export type EntryListItem = { id: string; status: EntryView['status']; supplier: { name: string } | null; _count: { items: number }; createdAt: string; updatedAt: string };

async function entryError(response: Response, fallback: string): Promise<never> {
  const error = await response.json().catch(() => null) as { message?: string } | null;
  throw new Error(error?.message ?? fallback);
}

export async function createEntry(payload: EntryDraftInput): Promise<EntryView> {
  const response = await fetch(apiUrl('/entries'), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'POST' });
  if (!response.ok) return entryError(response, 'Não foi possível criar a entrada.');
  return (await response.json() as { data: { entry: EntryView } }).data.entry;
}

export async function updateEntry(id: string, payload: EntryDraftInput): Promise<EntryView> {
  const response = await fetch(apiUrl(`/entries/${id}`), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'PATCH' });
  if (!response.ok) return entryError(response, 'Não foi possível atualizar a entrada.');
  return (await response.json() as { data: { entry: EntryView } }).data.entry;
}

export async function getEntry(id: string): Promise<EntryView> {
  const response = await fetch(apiUrl(`/entries/${id}`), { credentials: 'include' });
  if (!response.ok) return entryError(response, 'Não foi possível carregar a entrada.');
  return (await response.json() as { data: { entry: EntryView } }).data.entry;
}

export async function listEntries(params: { page: number; pageSize: number }): Promise<{ entries: EntryListItem[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  const response = await fetch(`${apiUrl('/entries')}?${query.toString()}`, { credentials: 'include' });
  if (!response.ok) return entryError(response, 'Não foi possível consultar as entradas.');
  return (await response.json() as { data: { entries: EntryListItem[]; total: number; page: number; pageSize: number; totalPages: number } }).data;
}

export async function confirmEntry(id: string): Promise<{ entry: EntryView; alreadyConfirmed: boolean }> {
  const response = await fetch(apiUrl(`/entries/${id}/confirm`), { method: 'POST', credentials: 'include' });
  if (!response.ok) return entryError(response, 'Não foi possível confirmar a entrada.');
  return (await response.json() as { data: { entry: EntryView; alreadyConfirmed: boolean } }).data;
}

export async function cancelEntry(id: string, justification: string): Promise<{ entry: EntryView; reversals: Array<{ productId: string; lotId: string | null; quantity: string }> }> {
  const response = await fetch(apiUrl(`/entries/${id}/cancel`), { body: JSON.stringify({ justification }), headers: { 'Content-Type': 'application/json' }, method: 'POST', credentials: 'include' });
  if (!response.ok) return entryError(response, 'Não foi possível cancelar a entrada.');
  return (await response.json() as { data: { entry: EntryView; reversals: Array<{ productId: string; lotId: string | null; quantity: string }> } }).data;
}

export type StockAdjustmentInput = { productId: string; direction: 'POSITIVE' | 'NEGATIVE'; quantity: number; justification: string };
export async function recordStockAdjustment(payload: StockAdjustmentInput): Promise<{ movement: { id: string; type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'; quantity: string; reason: string }; balance: string }> {
  const response = await fetch(apiUrl('/stock/adjustments'), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'POST' });
  if (!response.ok) return entryError(response, 'Não foi possível registrar o ajuste de estoque.');
  return (await response.json() as { data: { movement: { id: string; type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'; quantity: string; reason: string }; balance: string } }).data;
}

export type StockBalanceLot = { id: string; identifier: string; expirationDate: string | null; unitCost: string; initialQuantity: string; currentQuantity: string; receivedAt: string; available: boolean };
export type StockBalanceItem = { id: string; sku: string; name: string; unit: ProductListItem['unit']; stockMode: ProductListItem['stockMode']; status: ProductListItem['status']; physicalBalance: string; availableBalance: string; lots: StockBalanceLot[] };
export async function getStockBalances(params: { page: number; pageSize: number }): Promise<{ products: StockBalanceItem[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  const response = await fetch(`${apiUrl('/stock/balances')}?${query.toString()}`, { credentials: 'include' });
  if (!response.ok) return entryError(response, 'Não foi possível consultar os saldos de estoque.');
  return (await response.json() as { data: { products: StockBalanceItem[]; total: number; page: number; pageSize: number; totalPages: number } }).data;
}

export type StockExitInput = { productId: string; quantity: number; reason: string };
export type StockExitResult = { movements: Array<{ id: string; lotId: string | null; lotIdentifier: string | null; quantity: string }>; physicalBalance: string; availableBalance: string };
export async function recordStockExit(payload: StockExitInput): Promise<StockExitResult> {
  const response = await fetch(apiUrl('/stock/exits'), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'POST' });
  if (!response.ok) return entryError(response, 'Não foi possível registrar a saída de estoque.');
  return (await response.json() as { data: StockExitResult }).data;
}

export type StockLossReason = { id: string; name: string };
export type CustomStockLossReason = StockLossReason & { isActive: boolean };
export type StockLossInput = { productId: string; reasonId: string; quantity: number; lotId?: string; observations?: string };
export type StockLossLot = { id: string; identifier: string; expirationDate: string | null; currentQuantity: string; available: boolean };
export async function listProductLotsForLoss(productId: string): Promise<StockLossLot[]> {
  const response = await fetch(apiUrl(`/stock/products/${productId}/lots`), { credentials: 'include' });
  if (!response.ok) return entryError(response, 'Não foi possível consultar os lotes do produto.');
  return (await response.json() as { data: { lots: StockLossLot[] } }).data.lots;
}
export async function listStockLossReasons(): Promise<StockLossReason[]> {
  const response = await fetch(apiUrl('/stock/loss-reasons'), { credentials: 'include' });
  if (!response.ok) return entryError(response, 'Não foi possível consultar os motivos de perda.');
  return (await response.json() as { data: { reasons: StockLossReason[] } }).data.reasons;
}
export async function recordStockLoss(payload: StockLossInput): Promise<{ movement: { id: string; type: 'LOSS'; reason: string; quantity: string }; balance?: string }> {
  const response = await fetch(apiUrl('/stock/losses'), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'POST' });
  if (!response.ok) return entryError(response, 'Não foi possível registrar a perda.');
  return (await response.json() as { data: { movement: { id: string; type: 'LOSS'; reason: string; quantity: string }; balance?: string } }).data;
}
export async function listCustomStockLossReasons(): Promise<CustomStockLossReason[]> {
  const response = await fetch(apiUrl('/stock/loss-reasons/custom'), { credentials: 'include' });
  if (!response.ok) return entryError(response, 'Não foi possível consultar os motivos customizados.');
  return (await response.json() as { data: { reasons: CustomStockLossReason[] } }).data.reasons;
}
export async function createCustomStockLossReason(name: string): Promise<void> {
  const response = await fetch(apiUrl('/stock/loss-reasons/custom'), { body: JSON.stringify({ name }), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'POST' });
  if (!response.ok) return entryError(response, 'Não foi possível criar o motivo customizado.');
}
export async function updateCustomStockLossReason(id: string, payload: { name?: string; isActive?: boolean }): Promise<void> {
  const response = await fetch(apiUrl(`/stock/loss-reasons/custom/${id}`), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'PATCH' });
  if (!response.ok) return entryError(response, 'Não foi possível atualizar o motivo customizado.');
}

export type InventoryType = 'COMPLETE' | 'PARTIAL';
export type InventoryItemView = {
  id: string;
  productId: string;
  lotId: string | null;
  product: { id: string; sku: string; name: string; unit: ProductListItem['unit']; stockMode: ProductListItem['stockMode'] };
  lot: { id: string; identifier: string; expirationDate: string | null } | null;
  snapshotQuantity: string;
  countedQuantity: string | null;
  countedAt: string | null;
  expectedQuantity: string;
  divergence: string | null;
};
export type InventoryView = { id: string; type: InventoryType; status: 'EM_ANDAMENTO' | 'AGUARDANDO_CONFERENCIA' | 'CONFIRMADO' | 'CANCELADO'; observations: string | null; startedAt: string; finishedAt: string | null; createdAt: string; updatedAt: string; createdBy: { id: string; name: string }; items: InventoryItemView[] };
export type InventoryListItem = { id: string; type: InventoryType; status: InventoryView['status']; observations: string | null; startedAt: string; createdAt: string; updatedAt: string; createdBy: { name: string }; _count: { items: number } };
export async function createInventory(payload: { type: InventoryType; productIds?: string[]; categoryIds?: string[]; observations?: string }): Promise<InventoryView> {
  const response = await fetch(apiUrl('/inventories'), { body: JSON.stringify(payload), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'POST' });
  if (!response.ok) return entryError(response, 'Não foi possível criar o inventário.');
  return (await response.json() as { data: { inventory: InventoryView } }).data.inventory;
}
export async function listInventories(params: { page: number; pageSize: number }): Promise<{ inventories: InventoryListItem[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  const response = await fetch(`${apiUrl('/inventories')}?${query}`, { credentials: 'include' });
  if (!response.ok) return entryError(response, 'Não foi possível consultar os inventários.');
  return (await response.json() as { data: { inventories: InventoryListItem[]; total: number; page: number; pageSize: number; totalPages: number } }).data;
}
export async function getInventory(id: string): Promise<InventoryView> {
  const response = await fetch(apiUrl(`/inventories/${id}`), { credentials: 'include' });
  if (!response.ok) return entryError(response, 'Não foi possível carregar o inventário.');
  return (await response.json() as { data: { inventory: InventoryView } }).data.inventory;
}
export async function recordInventoryCount(inventoryId: string, itemId: string, countedQuantity: number): Promise<void> {
  const response = await fetch(apiUrl(`/inventories/${inventoryId}/items/${itemId}/count`), { body: JSON.stringify({ countedQuantity }), credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'PATCH' });
  if (!response.ok) return entryError(response, 'Não foi possível registrar a contagem.');
}
async function inventoryAction(inventoryId: string, action: 'review' | 'confirm' | 'cancel'): Promise<void> {
  const response = await fetch(apiUrl(`/inventories/${inventoryId}/${action}`), { credentials: 'include', headers: { 'Content-Type': 'application/json' }, method: 'POST' });
  if (!response.ok) return entryError(response, 'Não foi possível atualizar o inventário.');
}
export const submitInventoryForReview = (inventoryId: string) => inventoryAction(inventoryId, 'review');
export const confirmInventory = (inventoryId: string) => inventoryAction(inventoryId, 'confirm');
export const cancelInventory = (inventoryId: string) => inventoryAction(inventoryId, 'cancel');

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
