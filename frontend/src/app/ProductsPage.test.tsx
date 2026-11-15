import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from './auth-context';
import { ProductsPage } from './ProductsPage';

const { listCategories, listProducts, updateProductStatus } = vi.hoisted(() => ({ listCategories: vi.fn(), listProducts: vi.fn(), updateProductStatus: vi.fn() }));
vi.mock('@/lib/api', () => ({ listCategories, listProducts, updateProductStatus }));

describe('ProductsPage', () => {
  beforeEach(() => {
    listCategories.mockResolvedValue({ categories: [], total: 0, page: 1, pageSize: 100, totalPages: 0 });
    listProducts.mockResolvedValue({ products: [{ id: 'p1', sku: 'PRD-1', name: 'Água', description: null, barcode: null, categoryId: 'c1', unit: 'UN', salePrice: '2.50', minimumStock: '0', stockMode: 'SIMPLES', expirationAlertDays: 0, status: 'ACTIVE' }], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    updateProductStatus.mockResolvedValue(undefined);
  });

  it('allows a viewer to consult the product list without management actions', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={{ session: undefined, isLoading: false, hasPermission: (permission) => permission === 'products.read' }}><MemoryRouter><ProductsPage /></MemoryRouter></AuthContext.Provider></QueryClientProvider>);

    expect(await screen.findByRole('cell', { name: 'Água' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'PRD-1' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Novo produto' })).not.toBeInTheDocument();
  });

  it('lets a manager deactivate a product after confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={{ session: undefined, isLoading: false, hasPermission: (permission) => permission === 'products.read' || permission === 'products.manage' }}><MemoryRouter><ProductsPage /></MemoryRouter></AuthContext.Provider></QueryClientProvider>);

    await user.click(await screen.findByRole('button', { name: 'Inativar Água' }));
    expect(window.confirm).toHaveBeenCalledWith('Deseja inativar Água?');
    expect(updateProductStatus).toHaveBeenCalledWith('p1', 'INACTIVE');
  });
});
