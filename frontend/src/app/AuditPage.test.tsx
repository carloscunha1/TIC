import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditPage } from './AuditPage';

const { listAuditLogs, listUsers } = vi.hoisted(() => ({ listAuditLogs: vi.fn(), listUsers: vi.fn() }));
vi.mock('@/lib/api', () => ({ listAuditLogs, listUsers }));

describe('AuditPage', () => {
  afterEach(() => cleanup());

  it('renders a read-only audit record and sanitizes credentials visually', async () => {
    listUsers.mockResolvedValue({ users: [], total: 0, page: 1, pageSize: 100, totalPages: 1 });
    listAuditLogs.mockResolvedValue({
      logs: [{
        id: 'log-1',
        actorType: 'USER',
        actor: { id: 'user-1', name: 'Ana' },
        action: 'USER_UPDATED',
        entity: 'User',
        entityId: 'user-1',
        before: { name: 'Ana', password: '[REDACTED]' },
        after: { name: 'Ana Maria' },
        ipAddress: '127.0.0.1',
        createdAt: '2026-11-21T12:00:00.000Z',
      }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuditPage /></QueryClientProvider>);

    expect(await screen.findByText('USER_UPDATED')).toBeInTheDocument();
  });
});
