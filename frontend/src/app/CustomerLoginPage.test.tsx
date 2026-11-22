import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomerLoginPage } from './CustomerLoginPage';
const { getCustomerSession, getPublicCustomerLoyalty, loginCustomer, logoutCustomer } = vi.hoisted(() => ({ getCustomerSession: vi.fn(), getPublicCustomerLoyalty: vi.fn(), loginCustomer: vi.fn(), logoutCustomer: vi.fn() }));
vi.mock('@/lib/api', () => ({ getCustomerSession, getPublicCustomerLoyalty, loginCustomer, logoutCustomer }));
describe('CustomerLoginPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('authenticates by phone and PIN, then allows logout', async () => {
    loginCustomer.mockResolvedValue(undefined);
    getCustomerSession.mockRejectedValueOnce(new Error('Sessão inválida')).mockResolvedValue({ name: 'Ana', customerId: 'customer-id', expiresAt: '2026-11-15T12:05:00.000Z' });
    getPublicCustomerLoyalty.mockResolvedValue({ availablePoints: 35, nearExpiration: [], history: [] });
    logoutCustomer.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><CustomerLoginPage /></QueryClientProvider>);
    await user.type(screen.getByLabelText('Telefone'), '5516999999999');
    await user.type(screen.getByLabelText('PIN'), '123456');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Olá, Ana');
    expect(await screen.findByText('35 pontos')).toBeInTheDocument();
    expect(loginCustomer).toHaveBeenCalledWith('16999999999', '123456');
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(logoutCustomer).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });
});
