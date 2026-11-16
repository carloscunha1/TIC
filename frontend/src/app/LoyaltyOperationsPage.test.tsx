import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from './auth-context';
import { LoyaltyOperationsPage } from './LoyaltyOperationsPage';

const { getLoyaltyBalance } = vi.hoisted(() => ({ getLoyaltyBalance: vi.fn() }));
vi.mock('@/lib/api', () => ({ getLoyaltyBalance, awardLoyaltyPoints: vi.fn(), redeemLoyaltyPoints: vi.fn(), reverseLoyaltyAward: vi.fn(), reverseLoyaltyRedemption: vi.fn() }));

describe('LoyaltyOperationsPage', () => {
  afterEach(() => cleanup());

  it('allows an authorized operator to consult the points balance', async () => {
    getLoyaltyBalance.mockResolvedValue({ availablePoints: 42, debtPoints: 0 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{ session: undefined, isLoading: false, hasPermission: (permission) => permission === 'loyalty.read' || permission === 'sales.manage' }}>
          <MemoryRouter><LoyaltyOperationsPage /></MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Operações de pontos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consultar saldo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conceder pontos' })).toBeInTheDocument();
  });
});
