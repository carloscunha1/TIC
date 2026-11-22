import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EditCustomerPage } from './EditCustomerPage';

const { getCustomer, updateCustomer } = vi.hoisted(() => ({ getCustomer: vi.fn(), updateCustomer: vi.fn() }));
vi.mock('@/lib/api', () => ({ getCustomer, updateCustomer }));

describe('EditCustomerPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('loads and saves allowed customer fields', async () => {
    const user = userEvent.setup();
    getCustomer.mockResolvedValue({ id: 'customer-1', name: 'Ana Cliente', phone: '5516999999999', status: 'PENDING_PIN', privacyNoticeAcknowledgedAt: '2026-11-15T12:00:00.000Z', createdAt: '2026-11-15T12:00:00.000Z', updatedAt: '2026-11-15T12:00:00.000Z' });
    updateCustomer.mockResolvedValue({ id: 'customer-1', name: 'Ana Nova', phone: '5516333333333', status: 'PENDING_PIN' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/clientes/customer-1/editar']}><Routes><Route path="/clientes/:id/editar" element={<EditCustomerPage />} /><Route path="/clientes" element={<p>Lista de clientes</p>} /></Routes></MemoryRouter></QueryClientProvider>);

    const name = await screen.findByLabelText('Nome *');
    expect(name).toHaveValue('Ana Cliente');
    await user.clear(name);
    await user.type(name, 'Ana Nova');
    const phone = screen.getByLabelText('Telefone *');
    await user.clear(phone);
    await user.type(phone, '+55 (16) 33333-3333');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('customer-1', { name: 'Ana Nova', phone: '16333333333' }));
    expect(await screen.findByText('Lista de clientes')).toBeInTheDocument();
  });
});
