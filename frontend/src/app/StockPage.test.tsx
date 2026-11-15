import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StockPage } from './StockPage';

const { getStockBalances, listProducts, recordStockAdjustment, recordStockExit, listStockLossReasons, listCustomStockLossReasons, listProductLotsForLoss, recordStockLoss, createCustomStockLossReason, updateCustomStockLossReason } = vi.hoisted(() => ({ getStockBalances: vi.fn(), listProducts: vi.fn(), recordStockAdjustment: vi.fn(), recordStockExit: vi.fn(), listStockLossReasons: vi.fn(), listCustomStockLossReasons: vi.fn(), listProductLotsForLoss: vi.fn(), recordStockLoss: vi.fn(), createCustomStockLossReason: vi.fn(), updateCustomStockLossReason: vi.fn() }));
vi.mock('@/lib/api', () => ({ getStockBalances, listProducts, recordStockAdjustment, recordStockExit, listStockLossReasons, listCustomStockLossReasons, listProductLotsForLoss, recordStockLoss, createCustomStockLossReason, updateCustomStockLossReason }));
vi.mock('@/app/auth-context', () => ({ useAuth: () => ({ hasPermission: () => false }) }));

describe('StockPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    listProducts.mockResolvedValue({ products: [{ id: 'product-1', name: 'Água', unit: 'UN', stockMode: 'SIMPLES', stockBalance: '10', status: 'ACTIVE' }], total: 1, page: 1, pageSize: 100, totalPages: 1 });
    getStockBalances.mockResolvedValue({ products: [{ id: 'product-1', sku: 'SKU-1', name: 'Água', unit: 'UN', stockMode: 'SIMPLES', status: 'ACTIVE', physicalBalance: '10', availableBalance: '10', lots: [] }], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    recordStockAdjustment.mockResolvedValue({ movement: { id: 'movement-1', type: 'ADJUSTMENT_IN', quantity: '2', reason: 'Contagem física' }, balance: '12' });
    recordStockExit.mockResolvedValue({ movements: [{ id: 'movement-2', lotId: 'lot-1', lotIdentifier: 'L-1', quantity: '2' }], physicalBalance: '8', availableBalance: '8' });
    listStockLossReasons.mockResolvedValue([{ id: 'EXPIRED', name: 'Vencido' }, { id: 'DAMAGED', name: 'Danificado' }]);
    listProductLotsForLoss.mockResolvedValue([]);
    recordStockLoss.mockResolvedValue({ movement: { id: 'loss-1', type: 'LOSS', reason: 'Danificado', quantity: '1' }, balance: '9' });
  });

  it('requires justification and registers a positive adjustment', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><StockPage /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByLabelText('Produto simples *')).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText('Produto simples *'), 'product-1');
    await user.clear(screen.getByRole('textbox', { name: 'Justificativa *' }));
    fireEvent.change(screen.getByLabelText('Quantidade do ajuste *'), { target: { value: '2' } });
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
    await waitFor(() => expect(screen.getByLabelText('Produto simples *')).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText('Produto simples *'), 'product-1');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'NEGATIVE');
    fireEvent.change(screen.getByLabelText('Quantidade do ajuste *'), { target: { value: '2' } });
    await user.type(screen.getByRole('textbox', { name: 'Justificativa *' }), 'Correção de contagem');
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }));
    await waitFor(() => expect(recordStockAdjustment).toHaveBeenCalledWith({ productId: 'product-1', direction: 'NEGATIVE', quantity: 2, justification: 'Correção de contagem' }));
  });

  it('registers a common exit and reports the automatically selected lot', async () => {
    listProducts.mockResolvedValue({ products: [{ id: 'lot-product', name: 'Leite', unit: 'UN', stockMode: 'LOTE', stockBalance: null, status: 'ACTIVE' }], total: 1, page: 1, pageSize: 100, totalPages: 1 });
    getStockBalances.mockResolvedValue({ products: [{ id: 'lot-product', sku: 'SKU-2', name: 'Leite', unit: 'UN', stockMode: 'LOTE', status: 'ACTIVE', physicalBalance: '5', availableBalance: '4', lots: [{ id: 'lot-1', identifier: 'L-1', expirationDate: '2027-01-01', unitCost: '2.00', initialQuantity: '5', currentQuantity: '5', receivedAt: '2026-01-01T00:00:00.000Z', available: true }] }], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><StockPage /></MemoryRouter></QueryClientProvider>);
    await screen.findByText(/Lote L-1/);
    await user.selectOptions(screen.getByLabelText('Produto ativo *'), 'lot-product');
    fireEvent.change(screen.getByLabelText('Quantidade de saída *'), { target: { value: '2' } });
    await user.type(screen.getByLabelText('Motivo da saída *'), 'Venda registrada');
    await user.click(screen.getByRole('button', { name: 'Registrar saída' }));
    await waitFor(() => expect(recordStockExit).toHaveBeenCalledWith({ productId: 'lot-product', quantity: 2, reason: 'Venda registrada' }));
    expect(await screen.findByText('Lote L-1: 2')).toBeInTheDocument();
  });

  it('records a loss as a distinct movement and requires a reason', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><StockPage /></MemoryRouter></QueryClientProvider>);
    await screen.findByRole('heading', { name: 'Registrar perda' });
    await waitFor(() => expect(screen.getByLabelText('Produto *').querySelector('option[value="product-1"]')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Produto *'), 'product-1');
    await user.click(screen.getByRole('button', { name: 'Registrar perda' }));
    expect(await screen.findByText('Selecione um motivo.')).toBeInTheDocument();
    expect(recordStockLoss).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByRole('combobox', { name: /Motivo/ }), 'DAMAGED');
    await user.click(screen.getByRole('button', { name: 'Registrar perda' }));
    await waitFor(() => expect(recordStockLoss).toHaveBeenCalledWith({ productId: 'product-1', reasonId: 'DAMAGED', quantity: 1 }));
    expect(await screen.findByText(/Perda registrada/)).toBeInTheDocument();
  });

  it('offers specific lots to record a loss, including expired stock', async () => {
    listProducts.mockResolvedValue({ products: [{ id: 'lot-product', name: 'Leite', unit: 'UN', stockMode: 'LOTE', stockBalance: null, status: 'ACTIVE' }], total: 1, page: 1, pageSize: 100, totalPages: 1 });
    listProductLotsForLoss.mockResolvedValue([{ id: 'expired-lot', identifier: 'L-VENCIDO', expirationDate: '2026-01-01', currentQuantity: '4', available: false }]);
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><StockPage /></MemoryRouter></QueryClientProvider>);
    await screen.findByLabelText('Produto *');
    await waitFor(() => expect(screen.getByLabelText('Produto *').querySelector('option[value="lot-product"]')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Produto *'), 'lot-product');
    const lotSelect = await screen.findByLabelText('Lote *');
    await waitFor(() => expect(lotSelect.querySelector('option[value="expired-lot"]')).toHaveTextContent('L-VENCIDO'));
    await user.selectOptions(lotSelect, 'expired-lot');
    await user.selectOptions(screen.getByLabelText('Motivo *'), 'EXPIRED');
    await user.click(screen.getByRole('button', { name: 'Registrar perda' }));
    await waitFor(() => expect(recordStockLoss).toHaveBeenCalledWith({ productId: 'lot-product', reasonId: 'EXPIRED', quantity: 1, lotId: 'expired-lot' }));
  });
});
