import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoriesPage } from './InventoriesPage';

const { createInventory, getInventory, listCategories, listInventories, listProducts, recordInventoryCount } = vi.hoisted(() => ({ createInventory: vi.fn(), getInventory: vi.fn(), listCategories: vi.fn(), listInventories: vi.fn(), listProducts: vi.fn(), recordInventoryCount: vi.fn() }));
vi.mock('@/lib/api', () => ({ createInventory, getInventory, listCategories, listInventories, listProducts, recordInventoryCount }));

const inventory = {
  id: 'inventory-1', type: 'COMPLETE', status: 'EM_ANDAMENTO', observations: null, startedAt: '2026-11-15T10:00:00.000Z', createdAt: '2026-11-15T10:00:00.000Z', updatedAt: '2026-11-15T10:00:00.000Z', createdBy: { id: 'user-1', name: 'Operador' },
  items: [{ id: 'item-1', productId: 'product-1', lotId: null, product: { id: 'product-1', sku: 'SKU-1', name: 'Água', unit: 'UN', stockMode: 'SIMPLES' }, lot: null, snapshotQuantity: '8', countedQuantity: null, countedAt: null, expectedQuantity: '10', divergence: null }],
};

describe('InventoriesPage', () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    listInventories.mockResolvedValue({ inventories: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
    listCategories.mockResolvedValue({ categories: [{ id: 'category-1', name: 'Bebidas' }], total: 1, page: 1, pageSize: 100, totalPages: 1 });
    listProducts.mockResolvedValue({ products: [{ id: 'product-1', name: 'Água', sku: 'SKU-1', unit: 'UN', stockMode: 'SIMPLES', status: 'ACTIVE' }], total: 1, page: 1, pageSize: 100, totalPages: 1 });
    createInventory.mockResolvedValue(inventory);
    getInventory.mockResolvedValue(inventory);
    recordInventoryCount.mockResolvedValue(undefined);
  });

  function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(<QueryClientProvider client={client}><MemoryRouter><InventoriesPage /></MemoryRouter></QueryClientProvider>);
  }

  it('creates a complete inventory and opens its snapshot and counting form', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Novo inventário' }));
    await user.click(screen.getByRole('button', { name: 'Criar e iniciar contagem' }));
    await waitFor(() => expect(createInventory).toHaveBeenCalledWith({ type: 'COMPLETE' }));
    expect(await screen.findByText(/Snapshot de/)).toBeInTheDocument();
    expect(screen.getByText(/10 UN/)).toBeInTheDocument();
    expect(screen.getByText(/8 UN/)).toBeInTheDocument();
  });

  it('requires product or category selection and creates a partial inventory', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Novo inventário' }));
    await user.selectOptions(screen.getByLabelText('Tipo *'), 'PARTIAL');
    await user.click(screen.getByRole('button', { name: 'Criar e iniciar contagem' }));
    expect(await screen.findByText('Selecione produtos ou categorias para o inventário parcial.')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Água · SKU-1'));
    await user.click(screen.getByRole('button', { name: 'Criar e iniciar contagem' }));
    await waitFor(() => expect(createInventory).toHaveBeenCalledWith({ type: 'PARTIAL', productIds: ['product-1'], categoryIds: [] }));
  });

  it('records a count of zero without ending the inventory', async () => {
    const user = userEvent.setup();
    listInventories.mockResolvedValue({ inventories: [{ id: 'inventory-1', type: 'COMPLETE', status: 'EM_ANDAMENTO', observations: null, startedAt: '2026-11-15T10:00:00.000Z', createdAt: '2026-11-15T10:00:00.000Z', updatedAt: '2026-11-15T10:00:00.000Z', createdBy: { name: 'Operador' }, _count: { items: 1 } }], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Abrir contagem' }));
    await user.clear(await screen.findByLabelText('Contagem de Água'));
    await user.type(screen.getByLabelText('Contagem de Água'), '0');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(recordInventoryCount).toHaveBeenCalledWith('inventory-1', 'item-1', 0));
  });
});
