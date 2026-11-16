import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomerRegistrationForm } from './CustomerRegistrationForm';

const { createCustomer } = vi.hoisted(() => ({ createCustomer: vi.fn() }));
vi.mock('@/lib/api', () => ({ createCustomer }));

describe('CustomerRegistrationForm', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  function renderForm(mode: 'ADMIN' | 'QUICK' = 'ADMIN') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(<QueryClientProvider client={client}><CustomerRegistrationForm mode={mode} /></QueryClientProvider>);
  }

  it('requires privacy acknowledgment before creating a customer', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Nome *'), 'Ana Cliente');
    await user.type(screen.getByLabelText('Telefone *'), '(16) 99999-9999');
    await user.click(screen.getByRole('button', { name: 'Criar cliente' }));
    expect(await screen.findByText('Confirme a ciência do aviso de privacidade.')).toBeInTheDocument();
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('uses the quick registration endpoint and shows pending PIN state', async () => {
    const user = userEvent.setup();
    createCustomer.mockResolvedValue({ id: 'customer-1', status: 'PENDING_PIN' });
    renderForm('QUICK');
    await user.type(screen.getByLabelText('Nome *'), 'Ana Cliente');
    await user.type(screen.getByLabelText('Telefone *'), '16999999999');
    await user.click(screen.getByLabelText('O cliente recebeu e deu ciência do aviso de privacidade.'));
    await user.click(screen.getByRole('button', { name: 'Cadastrar cliente' }));
    await waitFor(() => expect(createCustomer).toHaveBeenCalledWith({ name: 'Ana Cliente', phone: '16999999999', privacyNoticeAcknowledged: true }, true));
    expect(await screen.findByRole('status')).toHaveTextContent('aguardando definição do PIN');
  });
});
