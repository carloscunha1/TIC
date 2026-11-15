import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryDraftPage } from './EntryDraftPage';

const { createEntry, getEntry, listProducts, listSuppliers, updateEntry } = vi.hoisted(() => ({ createEntry: vi.fn(), getEntry: vi.fn(), listProducts: vi.fn(), listSuppliers: vi.fn(), updateEntry: vi.fn() }));
vi.mock('@/lib/api', () => ({ createEntry, getEntry, listProducts, listSuppliers, updateEntry }));

const simpleProduct = { id: 'p-simple', name: 'Água', stockMode: 'SIMPLES', unit: 'UN' };
const lotProduct = { id: 'p-lot', name: 'Leite', stockMode: 'LOTE', unit: 'UN' };

function renderPage(path = '/entradas/nova') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path="/entradas/nova" element={<EntryDraftPage />} /><Route path="/entradas/:id/editar" element={<EntryDraftPage />} /><Route path="/entradas" element={<p>Lista de entradas</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe('EntryDraftPage', () => {
  beforeEach(() => {
    listProducts.mockResolvedValue({ products: [simpleProduct, lotProduct] });
    listSuppliers.mockResolvedValue({ suppliers: [{ id: 's1', name: 'Distribuidora' }] });
    createEntry.mockResolvedValue({ id: 'entry-1' });
    updateEntry.mockResolvedValue({ id: 'entry-1' });
    getEntry.mockResolvedValue({ id: 'entry-1', status: 'EM_ANDAMENTO', supplierId: null, items: [{ id: 'item-1', productId: simpleProduct.id, quantity: '2', unitCost: '1.50', lotIdentifier: null, expirationDate: null }] });
  });

  it('creates a draft with multiple items and optional supplier', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('option', { name: 'Água · simples' });
    await user.selectOptions(screen.getAllByLabelText('Produto *')[0], simpleProduct.id);
    await user.click(screen.getByRole('button', { name: 'Adicionar item' }));
    await user.selectOptions(screen.getAllByLabelText('Produto *')[1], lotProduct.id);
    await user.type(screen.getByLabelText('Identificação do lote *'), 'LOTE-45');
    await user.clear(screen.getAllByLabelText('Quantidade *')[1]);
    await user.type(screen.getAllByLabelText('Quantidade *')[1], '4');
    await user.click(screen.getByRole('button', { name: 'Criar entrada' }));
    await waitFor(() => expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ supplierId: null, items: expect.arrayContaining([expect.objectContaining({ productId: simpleProduct.id }), expect.objectContaining({ productId: lotProduct.id, lotIdentifier: 'LOTE-45' })]) })));
    expect(await screen.findByText('Lista de entradas')).toBeInTheDocument();
  });

  it('loads and saves edits for an in-progress entry', async () => {
    const user = userEvent.setup();
    renderPage('/entradas/entry-1/editar');
    expect(await screen.findByRole('heading', { name: 'Editar entrada em andamento' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Custo unitário (R$) *'));
    await user.type(screen.getByLabelText('Custo unitário (R$) *'), '2.75');
    await user.click(screen.getByRole('button', { name: 'Salvar entrada' }));
    await waitFor(() => expect(updateEntry).toHaveBeenCalledWith('entry-1', expect.objectContaining({ items: [expect.objectContaining({ productId: simpleProduct.id, unitCost: 2.75 })] })));
  });
});
