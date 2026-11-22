import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlertsPage } from './AlertsPage';

const { listAlerts, markAlertRead, markAllAlertsRead } = vi.hoisted(() => ({
  listAlerts: vi.fn(),
  markAlertRead: vi.fn(),
  markAllAlertsRead: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ listAlerts, markAlertRead, markAllAlertsRead }));

describe('AlertsPage', () => {
  afterEach(() => cleanup());

  it('filters alerts and supports individual and collective reads', async () => {
    listAlerts.mockResolvedValue({
      alerts: [{
        id: 'alert-1',
        type: 'ESTOQUE_ZERADO',
        priority: 'ALTA',
        status: 'ATIVO',
        title: 'Estoque zerado',
        message: 'Produto sem estoque.',
        detectedAt: '2026-11-21T12:00:00.000Z',
        resolvedAt: null,
        isRead: false,
        product: { name: 'Café' },
        lot: null,
        customer: null,
      }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    markAlertRead.mockResolvedValue(undefined);
    markAllAlertsRead.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AlertsPage /></QueryClientProvider>);

    expect(await screen.findByText('Estoque zerado')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Prioridade'), 'ALTA');
    await user.selectOptions(screen.getByLabelText('Status'), 'ATIVO');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'ESTOQUE_ZERADO');
    await user.click(screen.getByRole('button', { name: 'Marcar como lido' }));
    expect(markAlertRead.mock.calls[0]?.[0]).toBe('alert-1');
    await user.click(screen.getByRole('button', { name: 'Marcar todos como lidos' }));
    expect(markAllAlertsRead).toHaveBeenCalled();
  });
});
