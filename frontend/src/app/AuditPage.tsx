import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogs, listUsers } from '@/lib/api';

function dataLabel(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [actorUserId, setActorUserId] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const users = useQuery({ queryKey: ['audit', 'users'], queryFn: () => listUsers({ page: 1, pageSize: 100 }) });
  const query = useQuery({
    queryKey: ['audit', page, actorUserId, action, entity, from, to],
    queryFn: () => listAuditLogs({ page, pageSize: 20, actorUserId: actorUserId || undefined, action: action || undefined, entity: entity || undefined, from: from || undefined, to: to || undefined }),
  });
  return <section aria-labelledby="audit-title">
    <div className="mb-6"><p className="text-sm font-semibold text-[#0045B5] dark:text-blue-300">Segurança</p><h1 id="audit-title" className="mt-1 text-2xl font-bold">Auditoria</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Registros somente leitura das operações relevantes.</p></div>
    <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm font-medium">Usuário<select value={actorUserId} onChange={(event) => { setActorUserId(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Todos</option>{users.data?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
      <label className="text-sm font-medium">Ação<input value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" placeholder="Ex.: SALE_CANCELLED" /></label>
      <label className="text-sm font-medium">Entidade<input value={entity} onChange={(event) => { setEntity(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" placeholder="Ex.: Sale" /></label>
      <label className="text-sm font-medium">De<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
      <label className="text-sm font-medium">Até<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
    </div>
    {query.isLoading && <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando auditoria…</p>}
    {query.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{query.error.message}</p>}
    {query.data?.logs.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Nenhum registro encontrado.</p>}
    {query.data && query.data.logs.length > 0 && <><div className="space-y-3">{query.data.logs.map((log) => <article key={log.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{log.action}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{log.entity}{log.entityId ? ` · ${log.entityId}` : ''}</p></div><time className="text-sm text-slate-500 dark:text-slate-400" dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString('pt-BR')}</time></div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-medium">Responsável</dt><dd className="mt-1 text-slate-600 dark:text-slate-300">{log.actorType === 'SYSTEM' ? 'Sistema (SYSTEM)' : log.actor?.name ?? 'Usuário removido'}</dd></div><div><dt className="font-medium">IP</dt><dd className="mt-1 text-slate-600 dark:text-slate-300">{log.ipAddress ?? 'Não informado'}</dd></div></dl>
      <div className="mt-3 grid gap-3 md:grid-cols-2"><details className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer text-sm font-semibold">Dados anteriores</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">{dataLabel(log.before)}</pre></details><details className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer text-sm font-semibold">Dados posteriores</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">{dataLabel(log.after)}</pre></details></div>
    </article>)}</div><div className="mt-4 flex items-center justify-between text-sm"><span>{query.data.total} registro(s)</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {page} de {Math.max(query.data.totalPages, 1)}</span><button type="button" disabled={page >= query.data.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button></div></div></>}
  </section>;
}
