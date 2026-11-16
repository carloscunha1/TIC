import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomerPinSetupPage } from './CustomerPinSetupPage';
const { completeCustomerPinSetup } = vi.hoisted(() => ({ completeCustomerPinSetup: vi.fn() }));
vi.mock('@/lib/api', () => ({ completeCustomerPinSetup }));
describe('CustomerPinSetupPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('validates matching six-digit PINs and submits without displaying PIN values', async () => {
    completeCustomerPinSetup.mockResolvedValue(undefined);
    window.history.replaceState({}, '', '/fidelidade/definir-pin#token=abc');
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><CustomerPinSetupPage /></QueryClientProvider>);
    await user.type(screen.getByLabelText('Novo PIN'), '123456');
    await user.type(screen.getByLabelText('Confirme o PIN'), '123456');
    await user.click(screen.getByRole('button', { name: 'Definir PIN' }));
    expect(await screen.findByRole('status')).toHaveTextContent('PIN definido');
    expect(completeCustomerPinSetup).toHaveBeenCalledWith('abc', '123456');
    expect(window.location.hash).toBe('');
  });
  it('shows a generic invalid-link state when the token is missing', () => {
    window.history.replaceState({}, '', '/fidelidade/definir-pin');
    render(<QueryClientProvider client={new QueryClient()}><CustomerPinSetupPage /></QueryClientProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('não é válido');
  });
});
