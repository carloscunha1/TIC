import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAlerts, markAlertRead, markAllAlertsRead } from '@/lib/api';

const priorityLabel = { ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' } as const;

export function AlertsPage() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | 'ATIVO' | 'RESOLVIDO'>('');
  const [type, setType] = useState<'' | 'ESTOQUE_ZERADO' | 'ESTOQUE_ABAIXO_MINIMO' | 'LOTE_PROXIMO_VENCIMENTO' | 'LOTE_VENCIDO' | 'SALDO_FIDELIDADE_NEGATIVO'>('');
  const [priority, setPriority] = useState<'' | 'ALTA' | 'MEDIA' | 'BAIXA'>('');
  const query = useQuery({
    queryKey: ['alerts', page, status, type, priority],
    queryFn: () => listAlerts({ page, pageSize: 20, status: status || undefined, type: type || undefined, priority: priority || undefined }),
  });
  const invalidateAlerts = () => {
    void client.invalidateQueries({ queryKey: ['alerts'] });
    void client.invalidateQueries({ queryKey: ['alerts', 'notification-indicator'] });
  };
  const read = useMutation({ mutationFn: markAlertRead, onSuccess: invalidateAlerts });
  const readAll = useMutation({ mutationFn: markAllAlertsRead, onSuccess: invalidateAlerts });
  return <section aria-labelledby="alerts-title">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#0045B5] dark:text-blue-300">Operação</p><h1 id="alerts-title" className="mt-1 text-2xl font-bold">Alertas operacionais</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Estoque, validade e fidelidade.</p></div><button type="button" onClick={() => readAll.mutate()} disabled={readAll.isPending} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Marcar todos como lidos</button></div>
    <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
      <label className="text-sm font-medium">Status<select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Todos</option><option value="ATIVO">Ativo</option><option value="RESOLVIDO">Resolvido</option></select></label>
      <label className="text-sm font-medium">Tipo<select value={type} onChange={(event) => { setType(event.target.value as typeof type); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Todos</option><option value="ESTOQUE_ZERADO">Estoque zerado</option><option value="ESTOQUE_ABAIXO_MINIMO">Estoque abaixo do mínimo</option><option value="LOTE_PROXIMO_VENCIMENTO">Lote próximo do vencimento</option><option value="LOTE_VENCIDO">Lote vencido</option><option value="SALDO_FIDELIDADE_NEGATIVO">Saldo negativo de fidelidade</option></select></label>
      <label className="text-sm font-medium">Prioridade<select value={priority} onChange={(event) => { setPriority(event.target.value as typeof priority); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Todas</option><option value="ALTA">Alta</option><option value="MEDIA">Média</option><option value="BAIXA">Baixa</option></select></label>
    </div>
    {query.isLoading && <p role="status">Carregando alertas…</p>}
    {query.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{query.error.message}</p>}
    {query.data?.alerts.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Nenhum alerta encontrado.</p>}
    {query.data && query.data.alerts.length > 0 && <>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="sr-only">Alertas operacionais</caption><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="px-4 py-3">Prioridade</th><th className="px-4 py-3">Alerta</th><th className="px-4 py-3">Detectado em</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ação</th></tr></thead><tbody>{query.data.alerts.map((alert) => <tr key={alert.id} className={`border-t border-slate-200 dark:border-slate-800 ${!alert.isRead && alert.status === 'ATIVO' ? 'font-semibold' : ''}`}><td className="px-4 py-3">{priorityLabel[alert.priority]}</td><td className="px-4 py-3"><p>{alert.title}</p><p className="font-normal text-slate-500 dark:text-slate-400">{alert.message}</p></td><td className="px-4 py-3">{new Date(alert.detectedAt).toLocaleString('pt-BR')}</td><td className="px-4 py-3">{alert.status === 'ATIVO' ? 'Ativo' : 'Resolvido'}</td><td className="px-4 py-3">{!alert.isRead && <button type="button" onClick={() => read.mutate(alert.id)} className="font-semibold text-[#0045B5] dark:text-blue-300">Marcar como lido</button>}</td></tr>)}</tbody></table></div>
      <div className="mt-4 flex items-center justify-between text-sm"><span>{query.data.total} alerta(s)</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {page} de {Math.max(query.data.totalPages, 1)}</span><button type="button" disabled={page >= query.data.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button></div></div>
    </>}
  </section>;
}
