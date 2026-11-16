import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CustomersPage } from './CustomersPage';

const { listCustomers } = vi.hoisted(() => ({ listCustomers: vi.fn() }));
vi.mock('@/lib/api', () => ({ listCustomers }));

const firstPage = { customers: [{ id: 'customer-1', name: 'Ana Cliente', phone: '5516999999999', status: 'PENDING_PIN', createdAt: '2026-11-15T12:00:00.000Z' }], total: 25, page: 1, pageSize: 20, totalPages: 2 };

describe('CustomersPage', () => {
  afterEach(() => cleanup());
  beforeEach(() => { listCustomers.mockResolvedValue(firstPage); });

  function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><MemoryRouter><CustomersPage /></MemoryRouter></QueryClientProvider>);
  }

  it('displays status and searches by name or phone', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Ana Cliente')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Ana Cliente/ })).getByText('Pendente de PIN')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nome ou telefone'), '5516');
    await waitFor(() => expect(listCustomers).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: '5516', status: undefined }));
  });

  it('filters by pending PIN status and paginates', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Ana Cliente');
    await user.selectOptions(screen.getByLabelText('Status'), 'PENDING_PIN');
    await waitFor(() => expect(listCustomers).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: undefined, status: 'PENDING_PIN' }));
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(listCustomers).toHaveBeenLastCalledWith({ page: 2, pageSize: 20, search: undefined, status: 'PENDING_PIN' }));
  });
});
