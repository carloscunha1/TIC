import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditProductPage } from './EditProductPage';

const { getProduct, getProductValueHistory, listCategories, updateProduct } = vi.hoisted(() => ({ getProduct: vi.fn(), getProductValueHistory: vi.fn(), listCategories: vi.fn(), updateProduct: vi.fn() }));
const categoryId = '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c';
vi.mock('@/lib/api', () => ({ getProduct, getProductValueHistory, listCategories, updateProduct }));

describe('EditProductPage', () => {
  beforeEach(() => {
    getProduct.mockResolvedValue({ id: 'p1', sku: 'PRD-1', name: 'Água', description: 'Sem gás', barcode: null, categoryId, unit: 'UN', cost: '1.00', salePrice: '2.50', minimumStock: '0', stockMode: 'SIMPLES', expirationAlertDays: 15, status: 'ACTIVE', createdAt: '', updatedAt: '' });
    getProductValueHistory.mockResolvedValue([{ id: 'h1', field: 'SALE_PRICE', previousValue: '2.00', newValue: '2.50', source: 'MANUAL_EDIT', sourceId: null, changedByUserId: 'u1', changedByUser: { name: 'Admin' }, changedAt: '2026-11-15T10:00:00.000Z' }]);
    listCategories.mockResolvedValue({ categories: [{ id: categoryId, name: 'Bebidas', description: null, status: 'ACTIVE', createdAt: '' }], total: 1, page: 1, pageSize: 100, totalPages: 1 });
    updateProduct.mockResolvedValue(undefined);
  });

  it('loads product values and historical price changes, then submits edits', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/produtos/p1/editar']}><Routes><Route path="/produtos/:id/editar" element={<EditProductPage />} /><Route path="/produtos" element={<p>Lista de produtos</p>} /></Routes></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByRole('heading', { name: 'Editar produto' })).toBeInTheDocument();
    expect(screen.getByText('Preço de venda: 2.00 → 2.50')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled());
    await user.clear(screen.getByLabelText('Nome *'));
    await user.type(screen.getByLabelText('Nome *'), 'Água mineral');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Água mineral', cost: 1, salePrice: 2.5, stockMode: 'SIMPLES' })));
    expect(await screen.findByText('Lista de produtos')).toBeInTheDocument();
  });
});
