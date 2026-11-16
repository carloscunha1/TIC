import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from './auth-context';
import { LoyaltyPolicyPage } from './LoyaltyPolicyPage';
const { getLoyaltyPolicy, updateLoyaltyPolicy } = vi.hoisted(() => ({ getLoyaltyPolicy: vi.fn(), updateLoyaltyPolicy: vi.fn() }));
vi.mock('@/lib/api', () => ({ getLoyaltyPolicy, updateLoyaltyPolicy }));
const current = { id: 'policy-1', version: 1, pointsPerRealSpent: 1, redemptionPointsPerReal: 100, isActive: true, createdAt: '2026-11-15T12:00:00.000Z' };
describe('LoyaltyPolicyPage', () => {
  afterEach(() => cleanup());
  beforeEach(() => { getLoyaltyPolicy.mockResolvedValue({ current, history: [current] }); updateLoyaltyPolicy.mockResolvedValue({ policy: { ...current, version: 2, pointsPerRealSpent: 2 }, changed: true }); });
  function renderPage(canManage = true) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(<QueryClientProvider client={client}><AuthContext.Provider value={{ session: undefined, isLoading: false, hasPermission: (permission) => canManage && permission === 'loyalty-policy.manage' }}><MemoryRouter initialEntries={['/fidelidade/politica']}><Routes><Route path="/fidelidade/politica" element={<LoyaltyPolicyPage />} /><Route path="/" element={<p>Página inicial</p>} /></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>);
  }
  it('shows current and historical rates, then appends an updated policy version', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Política de pontos' })).toBeInTheDocument();
    expect(await screen.findByText('100', { selector: 'td' })).toBeInTheDocument();
    const earnField = screen.getByLabelText('Pontos ganhos por R$ 1,00 pago');
    await user.clear(earnField);
    await user.type(earnField, '2');
    await user.click(screen.getByRole('button', { name: 'Salvar nova versão' }));
    await waitFor(() => expect(updateLoyaltyPolicy).toHaveBeenCalledWith({ expectedVersion: 1, pointsPerRealSpent: 2, redemptionPointsPerReal: 100 }));
    expect(await screen.findByRole('status')).toHaveTextContent('versão 2');
  });
  it('does not expose policy controls without the management permission', async () => {
    renderPage(false);
    expect(await screen.findByText('Página inicial')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Política de pontos' })).not.toBeInTheDocument();
  });
});
