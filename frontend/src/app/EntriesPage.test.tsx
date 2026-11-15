import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntriesPage } from './EntriesPage';

const { confirmEntry, listEntries } = vi.hoisted(() => ({ confirmEntry: vi.fn(), listEntries: vi.fn() }));
vi.mock('@/lib/api', () => ({ confirmEntry, listEntries }));

describe('EntriesPage confirmation', () => {
  beforeEach(() => {
    listEntries.mockResolvedValue({ entries: [{ id: 'entry-1', supplier: { name: 'Distribuidora' }, _count: { items: 2 }, updatedAt: '2026-11-15T12:00:00.000Z', status: 'EM_ANDAMENTO' }], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    confirmEntry.mockResolvedValue({ entry: { id: 'entry-1', status: 'CONFIRMADA' }, alreadyConfirmed: false });
    vi.stubGlobal('confirm', vi.fn(() => true));
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
});
