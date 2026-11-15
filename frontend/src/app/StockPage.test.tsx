import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StockPage } from './StockPage';

const { listProducts, recordStockAdjustment } = vi.hoisted(() => ({ listProducts: vi.fn(), recordStockAdjustment: vi.fn() }));
vi.mock('@/lib/api', () => ({ listProducts, recordStockAdjustment }));

describe('StockPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    listProducts.mockResolvedValue({ products: [{ id: 'product-1', name: 'Água', unit: 'UN', stockMode: 'SIMPLES', stockBalance: '10', status: 'ACTIVE' }], total: 1, page: 1, pageSize: 100, totalPages: 1 });
    recordStockAdjustment.mockResolvedValue({ movement: { id: 'movement-1', type: 'ADJUSTMENT_IN', quantity: '2', reason: 'Contagem física' }, balance: '12' });
  });

  it('requires justification and registers a positive adjustment', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><StockPage /></MemoryRouter></QueryClientProvider>);
    await screen.findByRole('option', { name: /Água/ });
    await user.selectOptions(screen.getByLabelText('Produto *'), 'product-1');
    await user.clear(screen.getByRole('textbox', { name: 'Justificativa *' }));
    fireEvent.change(screen.getByLabelText('Quantidade *'), { target: { value: '2' } });
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }));
    expect(await screen.findByText('A justificativa é obrigatória.')).toBeInTheDocument();
    expect(recordStockAdjustment).not.toHaveBeenCalled();
    await user.type(screen.getByRole('textbox', { name: 'Justificativa *' }), 'Contagem física');
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }));
    await waitFor(() => expect(recordStockAdjustment).toHaveBeenCalledWith({ productId: 'product-1', direction: 'POSITIVE', quantity: 2, justification: 'Contagem física' }));
    expect(await screen.findByText('Ajuste registrado. Novo saldo: 12.')).toBeInTheDocument();
  });

  it('submits a negative adjustment with its direction', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><StockPage /></MemoryRouter></QueryClientProvider>);
    await screen.findByRole('option', { name: /Água/ });
    await user.selectOptions(screen.getByLabelText('Produto *'), 'product-1');
    await user.selectOptions(screen.getByLabelText('Tipo de ajuste'), 'NEGATIVE');
    fireEvent.change(screen.getByLabelText('Quantidade *'), { target: { value: '2' } });
    await user.type(screen.getByRole('textbox', { name: 'Justificativa *' }), 'Correção de contagem');
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }));
    await waitFor(() => expect(recordStockAdjustment).toHaveBeenCalledWith({ productId: 'product-1', direction: 'NEGATIVE', quantity: 2, justification: 'Correção de contagem' }));
  });
});
