import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntriesPage } from './EntriesPage';

const { cancelEntry, confirmEntry, listEntries } = vi.hoisted(() => ({ cancelEntry: vi.fn(), confirmEntry: vi.fn(), listEntries: vi.fn() }));
vi.mock('@/lib/api', () => ({ cancelEntry, confirmEntry, listEntries }));

describe('EntriesPage confirmation', () => {
  beforeEach(() => {
    listEntries.mockResolvedValue({ entries: [{ id: 'entry-1', supplier: { name: 'Distribuidora' }, _count: { items: 2 }, updatedAt: '2026-11-15T12:00:00.000Z', status: 'EM_ANDAMENTO' }], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    confirmEntry.mockResolvedValue({ entry: { id: 'entry-1', status: 'CONFIRMADA' }, alreadyConfirmed: false });
    cancelEntry.mockResolvedValue({ entry: { id: 'entry-1', status: 'CANCELADA' }, reversals: [] });
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('prompt', vi.fn(() => 'Lançamento duplicado'));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('asks for confirmation and reflects the successful stock receipt', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><EntriesPage /></MemoryRouter></QueryClientProvider>);
    await screen.findByText('Distribuidora');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(window.confirm).toHaveBeenCalledWith('Confirmar esta entrada e atualizar o estoque?');
    await waitFor(() => expect(confirmEntry).toHaveBeenCalled());
    expect(confirmEntry.mock.calls[0]?.[0]).toBe('entry-1');
    expect(await screen.findByRole('status')).toHaveTextContent('Entrada confirmada. O estoque foi atualizado.');
  });

  it('requests a justification and reflects a successful cancellation', async () => {
    listEntries.mockResolvedValue({ entries: [{ id: 'entry-2', status: 'CONFIRMADA', supplier: { name: 'Distribuidora' }, _count: { items: 2 }, updatedAt: '2026-11-15T12:00:00.000Z' }], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><EntriesPage /></MemoryRouter></QueryClientProvider>);
    await user.click(await screen.findByRole('button', { name: 'Cancelar entrada' }));
    expect(window.prompt).toHaveBeenCalled();
    await waitFor(() => expect(cancelEntry).toHaveBeenCalledWith('entry-2', 'Lançamento duplicado'));
    expect(await screen.findByText('Entrada cancelada. O estoque recebido foi estornado.')).toHaveAttribute('role', 'status');
  });
});
