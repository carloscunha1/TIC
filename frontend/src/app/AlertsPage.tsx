import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAlerts, markAlertRead, markAllAlertsRead } from '@/lib/api';

const priorityLabel = { ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' } as const;

export function AlertsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['alerts'], queryFn: () => listAlerts({ page: 1, pageSize: 100 }) });
  const invalidateAlerts = () => {
    void client.invalidateQueries({ queryKey: ['alerts'] });
    void client.invalidateQueries({ queryKey: ['alerts', 'notification-indicator'] });
  };
  const read = useMutation({ mutationFn: markAlertRead, onSuccess: invalidateAlerts });
  const readAll = useMutation({ mutationFn: markAllAlertsRead, onSuccess: invalidateAlerts });
  return <section aria-labelledby="alerts-title">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#0045B5] dark:text-blue-300">Operação</p><h1 id="alerts-title" className="mt-1 text-2xl font-bold">Alertas operacionais</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Estoque, validade e fidelidade.</p></div><button type="button" onClick={() => readAll.mutate()} disabled={readAll.isPending} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Marcar todos como lidos</button></div>
    {query.isLoading && <p role="status">Carregando alertas…</p>}
    {query.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{query.error.message}</p>}
    {query.data?.alerts.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Nenhum alerta encontrado.</p>}
    {query.data && query.data.alerts.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="sr-only">Alertas operacionais</caption><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="px-4 py-3">Prioridade</th><th className="px-4 py-3">Alerta</th><th className="px-4 py-3">Detectado em</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ação</th></tr></thead><tbody>{query.data.alerts.map((alert) => <tr key={alert.id} className={`border-t border-slate-200 dark:border-slate-800 ${!alert.isRead && alert.status === 'ATIVO' ? 'font-semibold' : ''}`}><td className="px-4 py-3">{priorityLabel[alert.priority]}</td><td className="px-4 py-3"><p>{alert.title}</p><p className="font-normal text-slate-500 dark:text-slate-400">{alert.message}</p></td><td className="px-4 py-3">{new Date(alert.detectedAt).toLocaleString('pt-BR')}</td><td className="px-4 py-3">{alert.status === 'ATIVO' ? 'Ativo' : 'Resolvido'}</td><td className="px-4 py-3">{!alert.isRead && <button type="button" onClick={() => read.mutate(alert.id)} className="font-semibold text-[#0045B5] dark:text-blue-300">Marcar como lido</button>}</td></tr>)}</tbody></table></div>}
  </section>;
}
