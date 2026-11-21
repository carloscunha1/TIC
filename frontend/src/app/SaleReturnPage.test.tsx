import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SaleReturnPage } from './SaleReturnPage';

const { getSale, returnSale } = vi.hoisted(() => ({ getSale: vi.fn(), returnSale: vi.fn() }));
vi.mock('@/lib/api', () => ({ getSale, returnSale }));

describe('SaleReturnPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    getSale.mockResolvedValue({
      id: 'sale-1',
      status: 'CONFIRMADA',
      paymentMethod: 'CASH',
      total: '12.00',
      items: [{ id: 'item-1', productId: 'product-1', quantity: '2', unitPrice: '6.00', total: '12.00', product: { id: 'product-1', name: 'Água', sku: 'SKU-1', unit: 'UN' } }],
    });
    returnSale.mockResolvedValue({});
  });

  it('sends the selected quantity and calculated refund amount', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/vendas/sale-1/devolucao']}><Routes><Route path="/vendas/:id/devolucao" element={<SaleReturnPage />} /><Route path="/vendas" element={null} /></Routes></MemoryRouter></QueryClientProvider>);
    const quantity = await screen.findByRole('spinbutton', { name: 'Quantidade de Água' });
    await user.type(quantity, '1');
    expect(screen.getByRole('spinbutton', { name: 'Valor do reembolso *' })).toHaveValue(6);
    await user.click(screen.getByRole('button', { name: 'Confirmar devolução' }));
    await waitFor(() => expect(returnSale).toHaveBeenCalledWith('sale-1', { items: [{ saleItemId: 'item-1', quantity: 1, destination: 'COMERCIALIZAVEL' }], refundAmount: 6, refundPaymentMethod: 'CASH' }));
  });

  it('requires at least one selected item', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/vendas/sale-1/devolucao']}><Routes><Route path="/vendas/:id/devolucao" element={<SaleReturnPage />} /><Route path="/vendas" element={null} /></Routes></MemoryRouter></QueryClientProvider>);
    await screen.findByRole('heading', { name: 'Registrar devolução' });
    await user.click(screen.getByRole('button', { name: 'Confirmar devolução' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Selecione ao menos um item');
    expect(returnSale).not.toHaveBeenCalled();
  });
});
